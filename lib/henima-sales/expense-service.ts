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

export async function sumExpenses(db: SalesDb, actor: Actor, opts: { from: string; to: string }) {
  const rows = await listExpenses(db, actor, opts);
  return rows.reduce((s, r) => s + Number(r.amount || 0), 0);
}
