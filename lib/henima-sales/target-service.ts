import { todayWib } from "@/lib/date";
import type { Actor, TargetPeriod } from "./types";
import { ForbiddenError, SalesError } from "./types";
import type { SalesDb } from "./db";
import { writeAudit } from "./audit";
import { targetWindow } from "./dates";
import { SALES_ORDER_SOURCE } from "./types";
import { loadTeamIds } from "./authz";

export type TargetRow = {
  id: string;
  business_id: string;
  sales_id: string | null;
  period_type: TargetPeriod;
  quantity_target: number;
  revenue_target: number | null;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
};

export async function upsertTarget(
  db: SalesDb,
  actor: Actor,
  input: {
    salesId?: string | null;
    periodType: TargetPeriod;
    quantityTarget: number;
    revenueTarget?: number;
    effectiveFrom: string;
    effectiveTo?: string | null;
  },
) {
  if (actor.role === "SALES") throw new ForbiddenError();
  const { data, error } = await db
    .from("module_sales_targets")
    .insert({
      business_id: actor.businessId,
      sales_id: input.salesId || null,
      period_type: input.periodType,
      quantity_target: input.quantityTarget,
      revenue_target: input.revenueTarget || 0,
      effective_from: input.effectiveFrom,
      effective_to: input.effectiveTo || null,
      active: true,
    })
    .select("*")
    .single();
  if (error || !data) throw new SalesError(error?.message || "Gagal simpan target.", "target_save");
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "UPDATE_TARGET",
    entityType: "target",
    entityId: data.id,
    newValue: input,
  });
  return data as TargetRow;
}

export async function listTargets(db: SalesDb, actor: Actor, salesId?: string) {
  let q = db
    .from("module_sales_targets")
    .select("*")
    .eq("business_id", actor.businessId)
    .eq("active", true)
    .order("effective_from", { ascending: false });
  const teamIds = await loadTeamIds(db, actor);
  if (actor.role === "SALES") q = q.or(`sales_id.eq.${actor.staffId},sales_id.is.null`);
  else if (actor.role === "LEADER") {
    const ids = [actor.staffId, ...teamIds];
    q = q.or(`sales_id.in.(${ids.join(",")}),sales_id.is.null`);
  }
  if (salesId) q = q.or(`sales_id.eq.${salesId},sales_id.is.null`);
  const { data, error } = await q;
  if (error) throw new SalesError(error.message, "target_list");
  return (data || []) as TargetRow[];
}

export async function achievementFor(
  db: SalesDb,
  actor: Actor,
  period: TargetPeriod,
  salesId?: string,
) {
  const ymd = todayWib();
  const win = targetWindow(period, ymd);
  const targets = await listTargets(db, actor, salesId || actor.staffId);
  const target =
    targets.find((t) => t.period_type === period && t.sales_id === (salesId || actor.staffId)) ||
    targets.find((t) => t.period_type === period && !t.sales_id);

  let q = db
    .from("orders")
    .select("id, total, order_items(qty)")
    .eq("business_id", actor.businessId)
    .eq("source", SALES_ORDER_SOURCE)
    .is("deleted_at", null)
    .eq("payment_status", "PAID")
    .gte("order_date", win.from)
    .lte("order_date", win.to);

  const sid = salesId || (actor.role === "SALES" ? actor.staffId : null);
  if (sid) q = q.eq("sales_id", sid);
  else if (actor.role === "LEADER") {
    const teamIds = await loadTeamIds(db, actor);
    q = q.in("sales_id", [actor.staffId, ...teamIds]);
  }

  const { data } = await q;
  const qty = (data || []).reduce(
    (s, o: { order_items?: { qty: number }[] }) =>
      s + (o.order_items || []).reduce((a, i) => a + Number(i.qty || 0), 0),
    0,
  );
  const omzet = (data || []).reduce((s, o: { total: number }) => s + Number(o.total || 0), 0);
  const goal = Number(target?.quantity_target || 0);
  const pct = goal > 0 ? Math.round((qty / goal) * 10000) / 100 : 0;
  return {
    period,
    from: win.from,
    to: win.to,
    sold: qty,
    omzet,
    target: goal,
    remaining: Math.max(0, goal - qty),
    achievement: pct,
  };
}
