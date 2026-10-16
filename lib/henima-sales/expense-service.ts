import { todayWib } from "@/lib/date";
import type { Actor } from "./types";
import { SalesError } from "./types";
import type { SalesDb } from "./db";
import { writeAudit } from "./audit";

export type ExpenseRow = {
  id: string;
  business_id: string;
  sales_id: string | null;
  amount: number;
  note: string | null;
  expense_date: string;
  created_at: string;
};

export async function createExpense(
  db: SalesDb,
  actor: Actor,
  input: { amount: number; note: string; expenseDate?: string },
) {
  const amount = Math.round(Number(input.amount) || 0);
  if (!(amount > 0)) throw new SalesError("Nominal biaya tidak valid.", "expense_amount");
  const note = (input.note || "Operasional").replace(/\s+/g, " ").trim().slice(0, 120);
  const expenseDate = input.expenseDate || todayWib();
  const { data, error } = await db
    .from("module_sales_expenses")
    .insert({
      business_id: actor.businessId,
      sales_id: actor.staffId,
      amount,
      note,
      expense_date: expenseDate,
      updated_at: new Date().toISOString(),
    })
    .select("id, business_id, sales_id, amount, note, expense_date, created_at")
    .single();
  if (error || !data) {
    if (/Could not find the table|schema cache|module_sales_expenses/i.test(error?.message || "")) {
      throw new SalesError(
        "Tabel biaya operasional belum aktif. Jalankan SQL 20261015_henima_sales_expenses di Supabase dulu.",
        "expense_schema",
        500,
      );
    }
    throw new SalesError(error?.message || "Gagal menyimpan biaya.", "expense_create");
  }
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "CREATE_EXPENSE",
    entityType: "expense",
    entityId: data.id,
    newValue: { amount, note, expense_date: expenseDate },
  });
  return data as ExpenseRow;
}

export async function listExpenses(
  db: SalesDb,
  actor: Actor,
  opts: { from: string; to: string },
) {
  const { data, error } = await db
    .from("module_sales_expenses")
    .select("id, business_id, sales_id, amount, note, expense_date, created_at")
    .eq("business_id", actor.businessId)
    .is("deleted_at", null)
    .gte("expense_date", opts.from)
    .lte("expense_date", opts.to)
    .order("expense_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    if (/Could not find the table|schema cache|module_sales_expenses/i.test(error.message || "")) return [];
    throw new SalesError(error.message, "expense_list");
  }
  return (data || []).map((row) => ({
    ...row,
    amount: Number(row.amount || 0),
  })) as ExpenseRow[];
}

export async function updateExpense(
  db: SalesDb,
  actor: Actor,
  id: string,
  patch: { amount?: number; note?: string; expenseDate?: string },
) {
  if (actor.role === "SALES") throw new SalesError("Ubah biaya hanya untuk founder dan leader.", "expense_role", 403);
  const { data: current, error: readErr } = await db
    .from("module_sales_expenses")
    .select("id, business_id, sales_id, amount, note, expense_date, created_at")
    .eq("id", id)
    .eq("business_id", actor.businessId)
    .is("deleted_at", null)
    .maybeSingle();
  if (readErr || !current) throw new SalesError("Pengeluaran tidak ditemukan.", "expense_missing");
  const amount = patch.amount != null ? Math.round(Number(patch.amount) || 0) : Number(current.amount);
  if (!(amount > 0)) throw new SalesError("Nominal biaya tidak valid.", "expense_amount");
  const note = (patch.note ?? current.note ?? "Operasional").replace(/\s+/g, " ").trim().slice(0, 120);
  const expenseDate = patch.expenseDate || current.expense_date;
  const { data, error } = await db
    .from("module_sales_expenses")
    .update({ amount, note, expense_date: expenseDate, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", actor.businessId)
    .is("deleted_at", null)
    .select("id, business_id, sales_id, amount, note, expense_date, created_at")
    .single();
  if (error || !data) throw new SalesError(error?.message || "Gagal mengubah biaya.", "expense_update");
  if (Number(data.amount) !== amount || data.note !== note || data.expense_date !== expenseDate) {
    throw new SalesError("Perubahan belum sesuai data tersimpan.", "expense_verify");
  }
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "UPDATE_EXPENSE",
    entityType: "expense",
    entityId: id,
    oldValue: { amount: Number(current.amount), note: current.note, expense_date: current.expense_date },
    newValue: { amount, note, expense_date: expenseDate },
  });
  return { ...data, amount: Number(data.amount) } as ExpenseRow;
}

export async function softDeleteExpense(db: SalesDb, actor: Actor, id: string) {
  if (actor.role === "SALES") throw new SalesError("Hapus biaya hanya untuk founder dan leader.", "expense_role", 403);
  const { data: current, error: readErr } = await db
    .from("module_sales_expenses")
    .select("id, amount, note, expense_date, deleted_at")
    .eq("id", id)
    .eq("business_id", actor.businessId)
    .maybeSingle();
  if (readErr || !current) throw new SalesError("Pengeluaran tidak ditemukan.", "expense_missing");
  if (current.deleted_at) return { already: true as const, id };
  const { error } = await db
    .from("module_sales_expenses")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", actor.businessId);
  if (error) throw new SalesError(error.message, "expense_delete");
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "DELETE_EXPENSE",
    entityType: "expense",
    entityId: id,
    oldValue: { amount: Number(current.amount), note: current.note, expense_date: current.expense_date },
  });
  return { already: false as const, id };
}

export async function sumExpenses(db: SalesDb, actor: Actor, opts: { from: string; to: string }) {
  const rows = await listExpenses(db, actor, opts);
  return rows.reduce((s, r) => s + Number(r.amount || 0), 0);
}
