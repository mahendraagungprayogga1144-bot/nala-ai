import { withSalesActor, readJson, queryParam } from "@/lib/henima-sales/http";
import {
  generatePayrollRun,
  listBonusRules,
  listHrEmployees,
  listPayrollRuns,
  markPayrollPaid,
  updateHrEmployee,
  upsertBonusRule,
} from "@/lib/henima-sales/hr-payroll-service";
import { SalesError } from "@/lib/henima-sales/types";
import { todayWib } from "@/lib/date";

export async function GET() {
  return withSalesActor(async ({ actor, db }) => {
    const [employees, bonusRules, payrollRuns] = await Promise.all([
      listHrEmployees(db, actor),
      listBonusRules(db, actor).catch(() => []),
      actor.role === "SALES" ? Promise.resolve([]) : listPayrollRuns(db, actor).catch(() => []),
    ]);
    return {
      employees,
      bonusRules,
      payrollRuns,
      defaultPeriod: todayWib().slice(0, 7),
    };
  });
}

export async function POST(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const body = await readJson(request);
    const action = String(body.action || "");

    if (action === "update_employee") {
      await updateHrEmployee(db, actor, {
        staffId: String(body.staffId || ""),
        joinedAt: body.joinedAt === undefined ? undefined : body.joinedAt || null,
        baseSalary: body.baseSalary == null ? undefined : Number(body.baseSalary),
        payDay: body.payDay == null ? undefined : Number(body.payDay),
        bankAccount: body.bankAccount === undefined ? undefined : body.bankAccount,
        employmentNote: body.employmentNote === undefined ? undefined : body.employmentNote,
      });
    } else if (action === "upsert_bonus") {
      await upsertBonusRule(db, actor, {
        id: body.id || null,
        name: String(body.name || ""),
        kind: body.kind === "fixed" ? "fixed" : "target_pct",
        minAchievementPct: Number(body.minAchievementPct ?? 100),
        bonusAmount: Number(body.bonusAmount || 0),
        active: body.active !== false,
      });
    } else if (action === "generate_payroll") {
      const periodYm = String(body.periodYm || queryParam(request, "period") || "").trim();
      if (!periodYm) throw new SalesError("Periode wajib (YYYY-MM).", "period_required");
      await generatePayrollRun(db, actor, periodYm);
    } else if (action === "mark_paid") {
      await markPayrollPaid(db, actor, String(body.runId || ""));
    } else {
      throw new SalesError("Aksi tidak dikenal.", "bad_action");
    }

    const [employees, bonusRules, payrollRuns] = await Promise.all([
      listHrEmployees(db, actor),
      listBonusRules(db, actor).catch(() => []),
      listPayrollRuns(db, actor).catch(() => []),
    ]);
    return { ok: true, employees, bonusRules, payrollRuns };
  });
}
