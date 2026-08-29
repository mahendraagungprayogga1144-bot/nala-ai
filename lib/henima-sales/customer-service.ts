import type { Actor, CustomerRow, CustomerStatus } from "./types";
import { ForbiddenError, NotFoundError, SalesError } from "./types";
import type { SalesDb } from "./db";
import { isValidPhoneId, normalizePhoneId } from "./phone";
import { writeAudit } from "./audit";
import { assertCanAccessStaff, loadTeamIds } from "./authz";

function scopedCustomerFilter(actor: Actor, teamIds: string[]) {
  if (actor.role === "FOUNDER") return null;
  if (actor.role === "LEADER") return [actor.staffId, ...teamIds];
  return [actor.staffId];
}

export async function findCustomerByPhone(
  db: SalesDb,
  actor: Actor,
  phone: string,
): Promise<CustomerRow | null> {
  const norm = normalizePhoneId(phone);
  if (!norm) return null;
  const { data } = await db
    .from("module_crm_customers")
    .select("*")
    .eq("business_id", actor.businessId)
    .eq("phone_normalized", norm)
    .maybeSingle();
  if (!data) return null;
  const teamIds = await loadTeamIds(db, actor);
  const scope = scopedCustomerFilter(actor, teamIds);
  if (scope && data.assigned_sales_id && !scope.includes(data.assigned_sales_id)) {
    throw new ForbiddenError("Customer sudah terdaftar pada sales lain.");
  }
  return data as CustomerRow;
}

export async function createCustomer(
  db: SalesDb,
  actor: Actor,
  input: {
    nama: string;
    phone: string;
    kota?: string | null;
    catatan?: string | null;
    assignedSalesId?: string | null;
  },
) {
  const nama = input.nama.trim();
  if (!nama) throw new SalesError("Nama customer wajib.", "name_required");
  const norm = normalizePhoneId(input.phone);
  if (!isValidPhoneId(norm)) throw new SalesError("Nomor WhatsApp tidak valid.", "phone_invalid");

  const existing = await findCustomerByPhone(db, actor, input.phone);
  if (existing) {
    return { customer: existing, duplicate: true as const };
  }

  const assigned = input.assignedSalesId || actor.staffId;
  const teamIds = await loadTeamIds(db, actor);
  assertCanAccessStaff(actor, assigned, teamIds);

  const { data, error } = await db
    .from("module_crm_customers")
    .insert({
      user_id: actor.ownerUserId,
      business_id: actor.businessId,
      nama,
      telepon: input.phone.trim(),
      whatsapp_phone: input.phone.trim(),
      kota: input.kota?.trim() || null,
      catatan: input.catatan?.trim() || null,
      phone_normalized: norm,
      assigned_sales_id: assigned,
      status: "NEW" satisfies CustomerStatus,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const again = await findCustomerByPhone(db, actor, input.phone);
      if (again) return { customer: again, duplicate: true as const };
    }
    throw new SalesError(error.message, "customer_create");
  }

  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "CREATE_CUSTOMER",
    entityType: "customer",
    entityId: data.id,
    newValue: { nama, phone_normalized: norm, assigned_sales_id: assigned },
  });
  return { customer: data as CustomerRow, duplicate: false as const };
}

export async function updateCustomer(
  db: SalesDb,
  actor: Actor,
  id: string,
  patch: Partial<{
    nama: string;
    phone: string;
    kota: string | null;
    catatan: string | null;
    status: CustomerStatus;
    assignedSalesId: string | null;
  }>,
) {
  const current = await getCustomer(db, actor, id);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.nama != null) updates.nama = patch.nama.trim();
  if (patch.kota !== undefined) updates.kota = patch.kota;
  if (patch.catatan !== undefined) updates.catatan = patch.catatan;
  if (patch.status) updates.status = patch.status;
  if (patch.assignedSalesId !== undefined) {
    if (actor.role === "SALES") throw new ForbiddenError();
    updates.assigned_sales_id = patch.assignedSalesId;
  }
  if (patch.phone != null) {
    const norm = normalizePhoneId(patch.phone);
    if (!isValidPhoneId(norm)) throw new SalesError("Nomor WhatsApp tidak valid.", "phone_invalid");
    const clash = await findCustomerByPhone(db, actor, patch.phone);
    if (clash && clash.id !== id) throw new SalesError("Customer sudah terdaftar.", "duplicate_phone");
    updates.telepon = patch.phone.trim();
    updates.whatsapp_phone = patch.phone.trim();
    updates.phone_normalized = norm;
  }
  const { data, error } = await db
    .from("module_crm_customers")
    .update(updates)
    .eq("id", id)
    .eq("business_id", actor.businessId)
    .select("*")
    .single();
  if (error || !data) throw new SalesError(error?.message || "Gagal update customer.", "customer_update");
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "UPDATE_CUSTOMER",
    entityType: "customer",
    entityId: id,
    oldValue: { nama: current.nama, status: current.status },
    newValue: { nama: data.nama, status: data.status },
  });
  return data as CustomerRow;
}

export async function getCustomer(db: SalesDb, actor: Actor, id: string): Promise<CustomerRow> {
  const { data } = await db
    .from("module_crm_customers")
    .select("*")
    .eq("id", id)
    .eq("business_id", actor.businessId)
    .maybeSingle();
  if (!data) throw new NotFoundError("Customer tidak ditemukan.");
  const teamIds = await loadTeamIds(db, actor);
  const scope = scopedCustomerFilter(actor, teamIds);
  if (scope && data.assigned_sales_id && !scope.includes(data.assigned_sales_id)) {
    throw new ForbiddenError("Anda tidak dapat melihat customer ini.");
  }
  return data as CustomerRow;
}

export async function listCustomers(
  db: SalesDb,
  actor: Actor,
  opts: {
    q?: string;
    status?: string;
    salesId?: string;
    page?: number;
    pageSize?: number;
  },
) {
  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize || 20));
  const from = (page - 1) * pageSize;
  const teamIds = await loadTeamIds(db, actor);
  const scope = scopedCustomerFilter(actor, teamIds);

  let q = db
    .from("module_crm_customers")
    .select("*", { count: "exact" })
    .eq("business_id", actor.businessId)
    .order("updated_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (scope) q = q.in("assigned_sales_id", scope);
  if (opts.salesId) {
    assertCanAccessStaff(actor, opts.salesId, teamIds);
    q = q.eq("assigned_sales_id", opts.salesId);
  }
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.q) {
    const term = opts.q.trim().replace(/[%_,()]/g, "").slice(0, 80);
    if (term) {
      const norm = normalizePhoneId(term);
      q = q.or(
        `nama.ilike.%${term}%,telepon.ilike.%${term}%,whatsapp_phone.ilike.%${term}%${norm ? `,phone_normalized.eq.${norm}` : ""}`,
      );
    }
  }

  const { data, error, count } = await q;
  if (error) throw new SalesError(error.message, "customer_list");
  return { rows: (data || []) as CustomerRow[], total: count || 0, page, pageSize };
}
