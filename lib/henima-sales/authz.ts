import type { Actor, SalesRole, StaffRow } from "./types";
import { ForbiddenError, NotFoundError, SalesError } from "./types";
import type { SalesDb } from "./db";
import { getSalesSettings } from "./settings-service";

export function staffScopeIds(actor: Actor, teamIds: string[]): string[] | null {
  if (actor.role === "FOUNDER") return null;
  if (actor.role === "LEADER") return Array.from(new Set([actor.staffId, ...teamIds]));
  return [actor.staffId];
}

export function canAccessStaff(actor: Actor, salesId: string, teamIds: string[]) {
  const scope = staffScopeIds(actor, teamIds);
  return !scope || scope.includes(salesId);
}

export function assertCanAccessStaff(actor: Actor, salesId: string, teamIds: string[]) {
  if (!canAccessStaff(actor, salesId, teamIds)) {
    throw new ForbiddenError("Anda tidak dapat mengakses data sales lain.");
  }
}

export async function loadTeamIds(db: SalesDb, actor: Actor): Promise<string[]> {
  if (actor.role !== "LEADER") return [];
  const { data } = await db
    .from("module_sales_staff")
    .select("id")
    .eq("business_id", actor.businessId)
    .eq("leader_id", actor.staffId)
    .eq("status", "active");
  return (data || []).map((r: { id: string }) => r.id);
}

export async function loadStaffRow(db: SalesDb, id: string): Promise<StaffRow | null> {
  const { data } = await db.from("module_sales_staff").select("*").eq("id", id).maybeSingle();
  return (data as StaffRow) || null;
}

async function businessOf(db: SalesDb, businessId: string) {
  const { data } = await db
    .from("businesses")
    .select("id, name, user_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!data) throw new NotFoundError("Bisnis tidak ditemukan.");
  return data as { id: string; name: string; user_id: string };
}

async function toActor(
  db: SalesDb,
  staff: StaffRow,
  business: { id: string; name: string; user_id: string },
): Promise<Actor> {
  const settings = await getSalesSettings(db, business.id, business.name);
  return {
    staffId: staff.id,
    businessId: staff.business_id,
    businessName: settings.displayName,
    ownerUserId: business.user_id,
    userId: staff.user_id,
    telegramUserId: staff.telegram_user_id,
    role: staff.role,
    nama: staff.nama,
    leaderId: staff.leader_id,
    tagline: settings.tagline,
  };
}

export async function ensureFounderStaff(
  db: SalesDb,
  opts: { businessId: string; ownerUserId: string; nama: string },
): Promise<StaffRow> {
  const { data: existing } = await db
    .from("module_sales_staff")
    .select("*")
    .eq("business_id", opts.businessId)
    .eq("role", "FOUNDER")
    .eq("user_id", opts.ownerUserId)
    .maybeSingle();
  if (existing) return existing as StaffRow;

  const { data: anyFounder } = await db
    .from("module_sales_staff")
    .select("*")
    .eq("business_id", opts.businessId)
    .eq("role", "FOUNDER")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (anyFounder) {
    if (!anyFounder.user_id) {
      const { data: updated } = await db
        .from("module_sales_staff")
        .update({ user_id: opts.ownerUserId, nama: opts.nama, updated_at: new Date().toISOString() })
        .eq("id", anyFounder.id)
        .select("*")
        .single();
      return (updated || anyFounder) as StaffRow;
    }
    return anyFounder as StaffRow;
  }

  const { data, error } = await db
    .from("module_sales_staff")
    .insert({
      business_id: opts.businessId,
      user_id: opts.ownerUserId,
      role: "FOUNDER" satisfies SalesRole,
      nama: opts.nama,
      status: "active",
    })
    .select("*")
    .single();
  if (error || !data) throw new SalesError(error?.message || "Gagal membuat founder.", "staff_create");
  return data as StaffRow;
}

export async function resolveActorByUserId(
  db: SalesDb,
  userId: string,
  preferredBusinessId?: string | null,
  displayName?: string,
): Promise<Actor> {
  const { data: owned } = await db
    .from("businesses")
    .select("id, name, user_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const list = owned || [];
  const preferred = preferredBusinessId
    ? list.find((b) => b.id === preferredBusinessId)
    : null;
  const ownedBiz = preferred || list[0] || null;

  if (ownedBiz) {
    const staff = await ensureFounderStaff(db, {
      businessId: ownedBiz.id,
      ownerUserId: userId,
      nama: displayName || "Owner",
    });
    return toActor(db, staff, ownedBiz);
  }

  const { data: staff } = await db
    .from("module_sales_staff")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!staff) throw new ForbiddenError("Akun ini belum terdaftar sebagai tim sales Henima.");
  const biz = await businessOf(db, staff.business_id);
  return toActor(db, staff as StaffRow, biz);
}

export async function resolveActorByTelegramId(db: SalesDb, telegramUserId: number): Promise<Actor | null> {
  const { data: staff } = await db
    .from("module_sales_staff")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .eq("status", "active")
    .maybeSingle();
  if (!staff) return null;
  const biz = await businessOf(db, staff.business_id);
  return toActor(db, staff as StaffRow, biz);
}

export async function linkTelegramByInvite(
  db: SalesDb,
  inviteCode: string,
  telegramUserId: number,
  telegramName: string,
): Promise<Actor> {
  const code = inviteCode.trim().toUpperCase();
  const { data: staff } = await db
    .from("module_sales_staff")
    .select("*")
    .eq("invite_code", code)
    .neq("status", "disabled")
    .maybeSingle();
  if (!staff) throw new NotFoundError("Kode undangan tidak valid.");

  const { data: taken } = await db
    .from("module_sales_staff")
    .select("id")
    .eq("telegram_user_id", telegramUserId)
    .neq("id", staff.id)
    .maybeSingle();
  if (taken) throw new SalesError("Telegram ini sudah terhubung ke akun lain.", "telegram_taken");

  const { data: updated, error } = await db
    .from("module_sales_staff")
    .update({
      telegram_user_id: telegramUserId,
      status: "active",
      nama: staff.nama || telegramName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", staff.id)
    .select("*")
    .single();
  if (error || !updated) throw new SalesError("Gagal menghubungkan Telegram.", "telegram_link");
  const biz = await businessOf(db, updated.business_id);
  return toActor(db, updated as StaffRow, biz);
}
