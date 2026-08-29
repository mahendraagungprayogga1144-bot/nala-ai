import { todayWib } from "@/lib/date";
import type { Actor, FollowUpStatus } from "./types";
import { ForbiddenError, NotFoundError, SalesError } from "./types";
import type { SalesDb } from "./db";
import { writeAudit } from "./audit";
import { getCustomer } from "./customer-service";
import { loadTeamIds } from "./authz";

export type FollowUpRow = {
  id: string;
  business_id: string;
  customer_id: string;
  sales_id: string;
  scheduled_at: string;
  status: FollowUpStatus;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
};

export async function createFollowUp(
  db: SalesDb,
  actor: Actor,
  input: { customerId: string; scheduledAt: string; notes?: string | null },
) {
  await getCustomer(db, actor, input.customerId);
  const { data, error } = await db
    .from("module_sales_follow_ups")
    .insert({
      business_id: actor.businessId,
      customer_id: input.customerId,
      sales_id: actor.staffId,
      scheduled_at: input.scheduledAt,
      status: "PENDING",
      notes: input.notes || null,
    })
    .select("*")
    .single();
  if (error || !data) throw new SalesError(error?.message || "Gagal membuat follow-up.", "followup_create");
  await db
    .from("module_crm_customers")
    .update({ status: "FOLLOW_UP", updated_at: new Date().toISOString() })
    .eq("id", input.customerId);
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "CREATE_FOLLOWUP",
    entityType: "follow_up",
    entityId: data.id,
    newValue: { customer_id: input.customerId, scheduled_at: input.scheduledAt },
  });
  return data as FollowUpRow;
}

export async function updateFollowUp(
  db: SalesDb,
  actor: Actor,
  id: string,
  patch: { status?: FollowUpStatus; notes?: string | null; scheduledAt?: string },
) {
  const row = await getFollowUp(db, actor, id);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) {
    updates.status = patch.status;
    if (patch.status !== "PENDING") updates.completed_at = new Date().toISOString();
  }
  if (patch.notes !== undefined) updates.notes = patch.notes;
  if (patch.scheduledAt) updates.scheduled_at = patch.scheduledAt;
  const { data, error } = await db
    .from("module_sales_follow_ups")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new SalesError(error?.message || "Gagal update follow-up.", "followup_update");
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "UPDATE_FOLLOWUP",
    entityType: "follow_up",
    entityId: id,
    oldValue: { status: row.status },
    newValue: { status: data.status },
  });
  return data as FollowUpRow;
}

export async function getFollowUp(db: SalesDb, actor: Actor, id: string) {
  const { data } = await db
    .from("module_sales_follow_ups")
    .select("*")
    .eq("id", id)
    .eq("business_id", actor.businessId)
    .maybeSingle();
  if (!data) throw new NotFoundError("Follow-up tidak ditemukan.");
  const teamIds = await loadTeamIds(db, actor);
  if (actor.role === "SALES" && data.sales_id !== actor.staffId) throw new ForbiddenError();
  if (actor.role === "LEADER" && data.sales_id !== actor.staffId && !teamIds.includes(data.sales_id)) {
    throw new ForbiddenError();
  }
  return data as FollowUpRow;
}

export async function listFollowUps(
  db: SalesDb,
  actor: Actor,
  opts: { date?: string; status?: string; page?: number; pageSize?: number },
) {
  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize || 30));
  const from = (page - 1) * pageSize;
  const teamIds = await loadTeamIds(db, actor);
  let q = db
    .from("module_sales_follow_ups")
    .select("*", { count: "exact" })
    .eq("business_id", actor.businessId)
    .order("scheduled_at", { ascending: true })
    .range(from, from + pageSize - 1);
  if (actor.role === "SALES") q = q.eq("sales_id", actor.staffId);
  else if (actor.role === "LEADER") q = q.in("sales_id", [actor.staffId, ...teamIds]);
  if (opts.date) q = q.eq("scheduled_at", opts.date);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error, count } = await q;
  if (error) throw new SalesError(error.message, "followup_list");
  return { rows: (data || []) as FollowUpRow[], total: count || 0, page, pageSize };
}

export async function todayFollowUps(db: SalesDb, actor: Actor) {
  return listFollowUps(db, actor, { date: todayWib(), status: "PENDING" });
}
