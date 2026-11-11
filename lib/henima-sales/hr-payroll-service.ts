import type { Actor } from "./types";
import { ForbiddenError, SalesError } from "./types";
import type { SalesDb } from "./db";
import { listStaff } from "./staff-service";
import { listCommissionLedger } from "./commission-service";
import { listTargets } from "./target-service";
import { SALES_ORDER_SOURCE } from "./types";
import { writeAudit } from "./audit";

export type HrEmployee = {
  id: string;
  nama: string;
  role: string;
  status: string;
  joinedAt: string | null;
  baseSalary: number;
  payDay: number;
  bankAccount: string | null;
  employmentNote: string | null;
};

export type BonusRule = {
  id: string;
  name: string;
  kind: "target_pct" | "fixed";
  minAchievementPct: number;
  bonusAmount: number;
  active: boolean;
};

export type PayrollLine = {
  id: string;
  salesId: string;
  salesName: string;
  baseSalary: number;
  commission: number;
  targetBonus: number;
  deduction: number;
  total: number;
  achievementPct: number;
  note: string | null;
  payDay: number;
  bankAccount: string | null;
};

export type PayrollRun = {
  id: string;
  periodYm: string;
  payDate: string;
  status: "draft" | "paid" | "void";
  note: string | null;
  lines: PayrollLine[];
  totals: { base: number; commission: number; bonus: number; deduction: number; total: number };
};

function money(n: number) {
  return Math.max(0, Math.round(Number(n) || 0));
}

function assertOwner(actor: Actor) {
  if (actor.role === "SALES") throw new ForbiddenError("Hanya owner/leader yang mengelola HR & gaji.");
}

function periodBounds(periodYm: string) {
  if (!/^\d{4}-\d{2}$/.test(periodYm)) throw new SalesError("Periode harus YYYY-MM.", "period_invalid");
  const [y, m] = periodYm.split("-").map(Number);
  const from = `${periodYm}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${periodYm}-${String(last).padStart(2, "0")}`;
  return { from, to, lastDay: last };
}

function payDateFor(periodYm: string, payDay: number) {
  const { lastDay } = periodBounds(periodYm);
  const day = Math.min(Math.max(1, payDay || 25), lastDay);
  return `${periodYm}-${String(day).padStart(2, "0")}`;
}

export async function listHrEmployees(db: SalesDb, actor: Actor): Promise<HrEmployee[]> {
  const staff = await listStaff(db, actor);
  return staff
    .filter((s) => s.role === "SALES" || s.role === "LEADER")
    .filter((s) => s.status !== "disabled")
    .map((s) => {
      const row = s as typeof s & {
        joined_at?: string | null;
        base_salary?: number | null;
        pay_day?: number | null;
        bank_account?: string | null;
        employment_note?: string | null;
      };
      return {
        id: s.id,
        nama: s.nama,
        role: s.role,
        status: s.status,
        joinedAt: row.joined_at || null,
        baseSalary: money(row.base_salary || 0),
        payDay: Math.min(28, Math.max(1, Number(row.pay_day || 25))),
        bankAccount: row.bank_account || null,
        employmentNote: row.employment_note || null,
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

export async function updateHrEmployee(
  db: SalesDb,
  actor: Actor,
  input: {
    staffId: string;
    joinedAt?: string | null;
    baseSalary?: number;
    payDay?: number;
    bankAccount?: string | null;
    employmentNote?: string | null;
  },
) {
  assertOwner(actor);
  if (actor.role === "LEADER" && input.staffId === actor.staffId) {
    /* leader boleh edit diri sendiri untuk data bank, tapi gaji hanya founder */
  }
  if (actor.role !== "FOUNDER" && (input.baseSalary != null || input.payDay != null)) {
    throw new ForbiddenError("Hanya founder yang mengubah gaji pokok / tanggal gajian.");
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.joinedAt !== undefined) patch.joined_at = input.joinedAt || null;
  if (input.baseSalary !== undefined) patch.base_salary = money(input.baseSalary);
  if (input.payDay !== undefined) patch.pay_day = Math.min(28, Math.max(1, Math.round(input.payDay)));
  if (input.bankAccount !== undefined) patch.bank_account = input.bankAccount?.trim() || null;
  if (input.employmentNote !== undefined) patch.employment_note = input.employmentNote?.trim() || null;

  const { data, error } = await db
    .from("module_sales_staff")
    .update(patch)
    .eq("id", input.staffId)
    .eq("business_id", actor.businessId)
    .select("id")
    .maybeSingle();
  if (error) {
    if (/joined_at|base_salary|pay_day|column/i.test(error.message)) {
      throw new SalesError(
        "Kolom HR belum aktif. Jalankan migration 20261112_henima_sales_hr_payroll.sql di Supabase.",
        "hr_migration",
      );
    }
    throw new SalesError(error.message, "hr_update");
  }
  if (!data) throw new SalesError("Sales tidak ditemukan.", "staff_missing");

  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "UPDATE_SETTINGS",
    entityType: "hr_employee",
    entityId: input.staffId,
    newValue: patch,
  });
  return { ok: true };
}

export async function listBonusRules(db: SalesDb, actor: Actor): Promise<BonusRule[]> {
  const { data, error } = await db
    .from("module_sales_hr_bonus_rules")
    .select("id, name, kind, min_achievement_pct, bonus_amount, active")
    .eq("business_id", actor.businessId)
    .order("created_at", { ascending: false });
  if (error) {
    if (/module_sales_hr_bonus_rules|does not exist|schema cache/i.test(error.message)) return [];
    throw new SalesError(error.message, "bonus_list");
  }
  return (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    kind: (r.kind === "fixed" ? "fixed" : "target_pct") as BonusRule["kind"],
    minAchievementPct: Number(r.min_achievement_pct || 100),
    bonusAmount: money(r.bonus_amount),
    active: Boolean(r.active),
  }));
}

export async function upsertBonusRule(
  db: SalesDb,
  actor: Actor,
  input: {
    id?: string | null;
    name: string;
    kind?: "target_pct" | "fixed";
    minAchievementPct?: number;
    bonusAmount: number;
    active?: boolean;
  },
) {
  if (actor.role !== "FOUNDER") throw new ForbiddenError("Hanya founder yang mengatur aturan bonus.");
  const name = input.name.trim();
  if (!name) throw new SalesError("Nama aturan bonus wajib.", "bonus_name");
  const row = {
    business_id: actor.businessId,
    name,
    kind: input.kind || "target_pct",
    min_achievement_pct: Number(input.minAchievementPct ?? 100),
    bonus_amount: money(input.bonusAmount),
    active: input.active !== false,
    updated_at: new Date().toISOString(),
  };
  const q = input.id
    ? db.from("module_sales_hr_bonus_rules").update(row).eq("id", input.id).eq("business_id", actor.businessId)
    : db.from("module_sales_hr_bonus_rules").insert(row);
  const { data, error } = await q.select("id").single();
  if (error) {
    if (/module_sales_hr_bonus_rules|does not exist|schema cache/i.test(error.message)) {
      throw new SalesError(
        "Tabel bonus belum aktif. Jalankan migration 20261112_henima_sales_hr_payroll.sql di Supabase.",
        "hr_migration",
      );
    }
    throw new SalesError(error.message, "bonus_save");
  }
  return { id: data.id };
}

export async function listPayrollRuns(db: SalesDb, actor: Actor): Promise<PayrollRun[]> {
  assertOwner(actor);
  const { data: runs, error } = await db
    .from("module_sales_hr_payroll_runs")
    .select("id, period_ym, pay_date, status, note")
    .eq("business_id", actor.businessId)
    .order("period_ym", { ascending: false })
    .limit(12);
  if (error) {
    if (/module_sales_hr_payroll_runs|does not exist|schema cache/i.test(error.message)) return [];
    throw new SalesError(error.message, "payroll_list");
  }
  if (!runs?.length) return [];

  const runIds = runs.map((r) => r.id);
  const { data: lines } = await db
    .from("module_sales_hr_payroll_lines")
    .select(
      "id, run_id, sales_id, base_salary, commission, target_bonus, deduction, total, achievement_pct, note",
    )
    .in("run_id", runIds);

  const employees = await listHrEmployees(db, actor);
  const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));

  return runs.map((run) => {
    const runLines = (lines || [])
      .filter((l) => l.run_id === run.id)
      .map((l) => {
        const emp = empMap[l.sales_id];
        return {
          id: l.id,
          salesId: l.sales_id,
          salesName: emp?.nama || "Sales",
          baseSalary: money(l.base_salary),
          commission: money(l.commission),
          targetBonus: money(l.target_bonus),
          deduction: money(l.deduction),
          total: money(l.total),
          achievementPct: Number(l.achievement_pct || 0),
          note: l.note,
          payDay: emp?.payDay || 25,
          bankAccount: emp?.bankAccount || null,
        };
      })
      .sort((a, b) => a.salesName.localeCompare(b.salesName, "id"));
    return {
      id: run.id,
      periodYm: run.period_ym,
      payDate: run.pay_date,
      status: run.status as PayrollRun["status"],
      note: run.note,
      lines: runLines,
      totals: {
        base: runLines.reduce((s, l) => s + l.baseSalary, 0),
        commission: runLines.reduce((s, l) => s + l.commission, 0),
        bonus: runLines.reduce((s, l) => s + l.targetBonus, 0),
        deduction: runLines.reduce((s, l) => s + l.deduction, 0),
        total: runLines.reduce((s, l) => s + l.total, 0),
      },
    };
  });
}

/** Susun slip gaji periode: gaji pokok + komisi lunas + bonus target. */
export async function generatePayrollRun(db: SalesDb, actor: Actor, periodYm: string) {
  if (actor.role !== "FOUNDER") throw new ForbiddenError("Hanya founder yang menyusun penggajian.");
  const { from, to } = periodBounds(periodYm);
  const employees = (await listHrEmployees(db, actor)).filter((e) => e.status === "active");
  if (!employees.length) {
    throw new SalesError("Tidak ada sales aktif untuk digaji.", "payroll_empty");
  }
  const rules = (await listBonusRules(db, actor)).filter((r) => r.active);
  // Tanggal bayar run = mode tanggal gajian karyawan (fallback 25).
  const dayCounts = new Map<number, number>();
  for (const e of employees) dayCounts.set(e.payDay, (dayCounts.get(e.payDay) || 0) + 1);
  const payDay =
    [...dayCounts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] || 25;
  const payDate = payDateFor(periodYm, payDay);

  const { data: existing } = await db
    .from("module_sales_hr_payroll_runs")
    .select("id, status")
    .eq("business_id", actor.businessId)
    .eq("period_ym", periodYm)
    .maybeSingle();
  if (existing?.status === "paid") {
    throw new SalesError("Periode ini sudah dibayar. Tidak bisa disusun ulang.", "payroll_locked");
  }

  let runId = existing?.id as string | undefined;
  if (!runId) {
    const { data, error } = await db
      .from("module_sales_hr_payroll_runs")
      .insert({
        business_id: actor.businessId,
        period_ym: periodYm,
        pay_date: payDate,
        status: "draft",
        created_by: actor.staffId,
      })
      .select("id")
      .single();
    if (error) {
      if (/module_sales_hr_payroll_runs|does not exist|schema cache/i.test(error.message)) {
        throw new SalesError(
          "Tabel payroll belum aktif. Jalankan migration 20261112_henima_sales_hr_payroll.sql di Supabase.",
          "hr_migration",
        );
      }
      throw new SalesError(error.message, "payroll_create");
    }
    runId = data.id;
  } else {
    await db
      .from("module_sales_hr_payroll_runs")
      .update({ pay_date: payDate, status: "draft", note: null })
      .eq("id", runId);
    await db.from("module_sales_hr_payroll_lines").delete().eq("run_id", runId);
  }

  const targets = await listTargets(db, actor).catch(() => []);
  const lineRows = [];
  for (const emp of employees) {
    const commission = await listCommissionLedger(db, actor, {
      from,
      to,
      salesId: emp.id,
    }).catch(() => ({ total: 0, rows: [] }));

    const personal =
      targets.find((t) => t.period_type === "monthly" && t.sales_id === emp.id) ||
      targets.find((t) => t.period_type === "monthly" && !t.sales_id);
    const revenueGoal = money(personal?.revenue_target || 0);
    const qtyGoal = money(personal?.quantity_target || 0);

    const { data: paidRows } = await db
      .from("orders")
      .select("total, order_items(qty)")
      .eq("business_id", actor.businessId)
      .eq("source", SALES_ORDER_SOURCE)
      .eq("sales_id", emp.id)
      .eq("payment_status", "PAID")
      .is("deleted_at", null)
      .gte("order_date", from)
      .lte("order_date", to);
    const omzet = (paidRows || []).reduce((s, o) => s + money(o.total), 0);
    const qty = (paidRows || []).reduce(
      (s, o: { order_items?: { qty: number }[] }) =>
        s + (o.order_items || []).reduce((a, i) => a + Number(i.qty || 0), 0),
      0,
    );
    const pct =
      revenueGoal > 0
        ? Math.round((omzet / revenueGoal) * 1000) / 10
        : qtyGoal > 0
          ? Math.round((qty / qtyGoal) * 1000) / 10
          : 0;
    let targetBonus = 0;
    for (const rule of rules) {
      const hit =
        rule.kind === "fixed" ? true : pct >= rule.minAchievementPct;
      if (hit) targetBonus += rule.bonusAmount;
    }
    const base = emp.baseSalary;
    const komisi = money(commission.total);
    const total = base + komisi + targetBonus;
    const notes: string[] = [];
    if (!emp.joinedAt) notes.push("Tanggal masuk belum diisi");
    if (!base) notes.push("Gaji pokok 0");
    if (pct >= 100) notes.push("Target tercapai");
    else if (pct > 0) notes.push(`Pencapaian ${Math.round(pct)}%`);
    if (emp.bankAccount) notes.push(`Rek: ${emp.bankAccount}`);
    lineRows.push({
      run_id: runId,
      business_id: actor.businessId,
      sales_id: emp.id,
      base_salary: base,
      commission: komisi,
      target_bonus: targetBonus,
      deduction: 0,
      total,
      achievement_pct: pct,
      note: notes.length ? notes.join(" · ") : null,
    });
  }

  if (lineRows.length) {
    const { error } = await db.from("module_sales_hr_payroll_lines").insert(lineRows);
    if (error) throw new SalesError(error.message, "payroll_lines");
  }

  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "UPDATE_SETTINGS",
    entityType: "hr_payroll_run",
    entityId: runId,
    newValue: { periodYm, payDate, employees: lineRows.length },
  });

  const runs = await listPayrollRuns(db, actor);
  return runs.find((r) => r.id === runId) || null;
}

export async function markPayrollPaid(db: SalesDb, actor: Actor, runId: string) {
  if (actor.role !== "FOUNDER") throw new ForbiddenError();
  const { error } = await db
    .from("module_sales_hr_payroll_runs")
    .update({ status: "paid" })
    .eq("id", runId)
    .eq("business_id", actor.businessId);
  if (error) throw new SalesError(error.message, "payroll_pay");
  return { ok: true };
}

export async function deleteBonusRule(db: SalesDb, actor: Actor, ruleId: string) {
  if (actor.role !== "FOUNDER") throw new ForbiddenError("Hanya founder yang menghapus aturan bonus.");
  if (!ruleId) throw new SalesError("ID aturan wajib.", "bonus_id");
  const { error } = await db
    .from("module_sales_hr_bonus_rules")
    .delete()
    .eq("id", ruleId)
    .eq("business_id", actor.businessId);
  if (error) throw new SalesError(error.message, "bonus_delete");
  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "UPDATE_SETTINGS",
    entityType: "hr_bonus_rule",
    entityId: ruleId,
    newValue: { deleted: true },
  });
  return { ok: true };
}

async function assertDraftRun(db: SalesDb, actor: Actor, runId: string) {
  const { data: run, error } = await db
    .from("module_sales_hr_payroll_runs")
    .select("id, status")
    .eq("id", runId)
    .eq("business_id", actor.businessId)
    .maybeSingle();
  if (error) throw new SalesError(error.message, "payroll_read");
  if (!run) throw new SalesError("Slip periode tidak ditemukan.", "payroll_missing");
  if (run.status === "paid") {
    throw new SalesError("Sudah dibayar — tidak bisa diubah/dihapus. Susun periode baru bila perlu.", "payroll_locked");
  }
  return run;
}

export async function updatePayrollLine(
  db: SalesDb,
  actor: Actor,
  input: {
    lineId: string;
    baseSalary?: number;
    commission?: number;
    targetBonus?: number;
    deduction?: number;
    note?: string | null;
  },
) {
  if (actor.role !== "FOUNDER") throw new ForbiddenError("Hanya founder yang mengedit slip gaji.");
  if (!input.lineId) throw new SalesError("ID slip wajib.", "line_id");

  const { data: line, error: readErr } = await db
    .from("module_sales_hr_payroll_lines")
    .select("id, run_id, base_salary, commission, target_bonus, deduction, note")
    .eq("id", input.lineId)
    .eq("business_id", actor.businessId)
    .maybeSingle();
  if (readErr) throw new SalesError(readErr.message, "line_read");
  if (!line) throw new SalesError("Slip tidak ditemukan.", "line_missing");

  await assertDraftRun(db, actor, line.run_id);

  const base = input.baseSalary !== undefined ? money(input.baseSalary) : money(line.base_salary);
  const commission = input.commission !== undefined ? money(input.commission) : money(line.commission);
  const targetBonus = input.targetBonus !== undefined ? money(input.targetBonus) : money(line.target_bonus);
  const deduction = input.deduction !== undefined ? money(input.deduction) : money(line.deduction);
  const total = Math.max(0, base + commission + targetBonus - deduction);
  const patch: Record<string, unknown> = {
    base_salary: base,
    commission,
    target_bonus: targetBonus,
    deduction,
    total,
  };
  if (input.note !== undefined) patch.note = input.note?.trim() || null;

  const { error } = await db
    .from("module_sales_hr_payroll_lines")
    .update(patch)
    .eq("id", input.lineId)
    .eq("business_id", actor.businessId);
  if (error) throw new SalesError(error.message, "line_update");

  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "UPDATE_SETTINGS",
    entityType: "hr_payroll_line",
    entityId: input.lineId,
    newValue: patch,
  });
  return { ok: true };
}

export async function deletePayrollLine(db: SalesDb, actor: Actor, lineId: string) {
  if (actor.role !== "FOUNDER") throw new ForbiddenError("Hanya founder yang menghapus slip.");
  if (!lineId) throw new SalesError("ID slip wajib.", "line_id");

  const { data: line, error: readErr } = await db
    .from("module_sales_hr_payroll_lines")
    .select("id, run_id")
    .eq("id", lineId)
    .eq("business_id", actor.businessId)
    .maybeSingle();
  if (readErr) throw new SalesError(readErr.message, "line_read");
  if (!line) throw new SalesError("Slip tidak ditemukan.", "line_missing");

  await assertDraftRun(db, actor, line.run_id);

  const { error } = await db
    .from("module_sales_hr_payroll_lines")
    .delete()
    .eq("id", lineId)
    .eq("business_id", actor.businessId);
  if (error) throw new SalesError(error.message, "line_delete");

  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "UPDATE_SETTINGS",
    entityType: "hr_payroll_line",
    entityId: lineId,
    newValue: { deleted: true },
  });
  return { ok: true };
}

export async function deletePayrollRun(db: SalesDb, actor: Actor, runId: string) {
  if (actor.role !== "FOUNDER") throw new ForbiddenError("Hanya founder yang menghapus periode gaji.");
  if (!runId) throw new SalesError("ID periode wajib.", "run_id");
  await assertDraftRun(db, actor, runId);

  const { error: linesErr } = await db.from("module_sales_hr_payroll_lines").delete().eq("run_id", runId);
  if (linesErr) throw new SalesError(linesErr.message, "payroll_lines_delete");

  const { error } = await db
    .from("module_sales_hr_payroll_runs")
    .delete()
    .eq("id", runId)
    .eq("business_id", actor.businessId);
  if (error) throw new SalesError(error.message, "payroll_delete");

  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "UPDATE_SETTINGS",
    entityType: "hr_payroll_run",
    entityId: runId,
    newValue: { deleted: true },
  });
  return { ok: true };
}
