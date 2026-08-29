import type { Actor, CommissionRule, SalesRole } from "./types";
import { ForbiddenError, SalesError } from "./types";
import type { SalesDb } from "./db";
import { writeAudit } from "./audit";
import { loadTeamIds } from "./authz";

export async function listCommissionRules(db: SalesDb, actor: Actor) {
  if (actor.role === "SALES") throw new ForbiddenError("Hanya leader/founder yang mengelola aturan komisi.");
  const { data, error } = await db
    .from("module_sales_commission_rules")
    .select("*")
    .eq("business_id", actor.businessId)
    .order("effective_from", { ascending: false });
  if (error) throw new SalesError(error.message, "rule_list");
  return (data || []) as CommissionRule[];
}

export async function upsertCommissionRule(
  db: SalesDb,
  actor: Actor,
  input: {
    salesId?: string | null;
    role?: SalesRole | null;
    productId?: string | null;
    fixedAmount: number;
    percentage: number;
    effectiveFrom: string;
    effectiveTo?: string | null;
    active?: boolean;
    id?: string;
  },
) {
  if (actor.role !== "FOUNDER") throw new ForbiddenError();
  const row = {
    business_id: actor.businessId,
    sales_id: input.salesId || null,
    role: input.role || null,
    product_id: input.productId || null,
    fixed_amount: input.fixedAmount || 0,
    percentage: input.percentage || 0,
    effective_from: input.effectiveFrom,
    effective_to: input.effectiveTo || null,
    active: input.active !== false,
    updated_at: new Date().toISOString(),
  };
  const q = input.id
    ? db.from("module_sales_commission_rules").update(row).eq("id", input.id).eq("business_id", actor.businessId)
    : db.from("module_sales_commission_rules").insert(row);
  const { data, error } = await q.select("*").single();
  if (error || !data) throw new SalesError(error?.message || "Gagal simpan aturan komisi.", "rule_save");
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "UPDATE_COMMISSION",
    entityType: "commission_rule",
    entityId: data.id,
    newValue: row,
  });
  return data;
}

export async function listCommissionLedger(
  db: SalesDb,
  actor: Actor,
  opts: { from?: string; to?: string; salesId?: string },
) {
  const teamIds = await loadTeamIds(db, actor);
  let q = db
    .from("module_sales_commission_ledger")
    .select("*, orders(order_date, total, deleted_at, payment_status)")
    .eq("business_id", actor.businessId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (actor.role === "SALES") q = q.eq("sales_id", actor.staffId);
  else if (actor.role === "LEADER") q = q.in("sales_id", [actor.staffId, ...teamIds]);
  if (opts.salesId) q = q.eq("sales_id", opts.salesId);
  const { data, error } = await q;
  if (error) throw new SalesError(error.message, "ledger_list");
  const rows = (data || []).filter((r: { orders?: { deleted_at?: string | null; order_date?: string } | { deleted_at?: string | null; order_date?: string }[] }) => {
    const o = Array.isArray(r.orders) ? r.orders[0] : r.orders;
    if (!o || o.deleted_at) return false;
    if (opts.from && o.order_date && o.order_date < opts.from) return false;
    if (opts.to && o.order_date && o.order_date > opts.to) return false;
    return true;
  });
  const total = rows.reduce((s: number, r: { amount: number }) => s + Number(r.amount || 0), 0);
  return { rows, total };
}
