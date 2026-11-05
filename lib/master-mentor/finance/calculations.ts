import type { FinancialRecord } from "../memory-types";
import { metricLabel } from "../memory-types";

export type FinanceSnapshot = {
  currency: string;
  byMetric: Record<
    string,
    {
      actual: number | null;
      estimate: number | null;
      projection: number | null;
      latestActualDate: string | null;
    }
  >;
  derived: {
    grossProfitActual: number | null;
    netProfitActual: number | null;
    grossMarginPct: number | null;
    contributionAvailable: boolean;
    notes: string[];
  };
  missing: string[];
  evidence: string[];
};

function sumLatestPerMetric(rows: FinancialRecord[], metric: string, certainty: FinancialRecord["certainty"]) {
  const filtered = rows
    .filter((r) => r.metric_type === metric && r.certainty === certainty)
    .sort((a, b) => (a.transaction_date < b.transaction_date ? 1 : -1));
  if (!filtered.length) return { amount: null as number | null, date: null as string | null };
  // Sum same-date latest day entries for that metric/certainty
  const day = filtered[0].transaction_date;
  const amount = filtered.filter((r) => r.transaction_date === day).reduce((a, r) => a + Number(r.amount || 0), 0);
  return { amount, date: day };
}

/**
 * Financial calculation service for CFO Agent.
 * Uses only owner-entered Financial Memory rows. Never invents amounts.
 */
export function buildFinanceSnapshot(rows: FinancialRecord[], currencyFallback = "IDR"): FinanceSnapshot {
  const currency = rows[0]?.currency || currencyFallback;
  const byMetric: FinanceSnapshot["byMetric"] = {};
  const evidence: string[] = [];
  const missing: string[] = [];


  for (const metric of [
    "revenue",
    "cogs",
    "gross_profit",
    "operating_expenses",
    "net_profit",
    "cash_inflow",
    "cash_outflow",
    "cash_balance",
    "investment",
    "debt_liabilities",
  ]) {
    const actual = sumLatestPerMetric(rows, metric, "actual");
    const estimate = sumLatestPerMetric(rows, metric, "estimate");
    const projection = sumLatestPerMetric(rows, metric, "projection");
    byMetric[metric] = {
      actual: actual.amount,
      estimate: estimate.amount,
      projection: projection.amount,
      latestActualDate: actual.date,
    };
    if (actual.amount != null) {
      evidence.push(
        `${metricLabel(metric)} actual ${actual.amount} ${currency} @ ${actual.date} (owner financial memory)`,
      );
    }
  }

  const revenue = byMetric.revenue?.actual;
  const cogs = byMetric.cogs?.actual;
  const grossStored = byMetric.gross_profit?.actual;
  const opex = byMetric.operating_expenses?.actual;
  const netStored = byMetric.net_profit?.actual;

  const notes: string[] = [];
  let grossProfitActual: number | null = grossStored;
  if (grossProfitActual == null && revenue != null && cogs != null) {
    grossProfitActual = revenue - cogs;
    notes.push("Gross profit derived from latest actual revenue − COGS (same currency).");
  }
  let netProfitActual: number | null = netStored;
  if (netProfitActual == null && grossProfitActual != null && opex != null) {
    netProfitActual = grossProfitActual - opex;
    notes.push("Net profit derived from gross profit − operating expenses.");
  }

  let grossMarginPct: number | null = null;
  if (grossProfitActual != null && revenue != null && revenue !== 0) {
    grossMarginPct = (grossProfitActual / revenue) * 100;
  }

  if (revenue == null) missing.push("Actual revenue belum tersedia di Financial Memory.");
  if (cogs == null && grossStored == null) missing.push("Actual COGS / gross profit belum tersedia.");
  if (opex == null && netStored == null) missing.push("Actual operating expenses / net profit belum tersedia.");
  if (!rows.length) missing.push("Tidak ada financial record untuk bisnis ini.");

  // Currency consistency check
  const currencies = new Set(rows.map((r) => r.currency || "IDR"));
  if (currencies.size > 1) {
    notes.push(
      `Peringatan: ada lebih dari satu mata uang (${Array.from(currencies).join(", ")}). Jangan campur tanpa konversi.`,
    );
  }

  return {
    currency,
    byMetric,
    derived: {
      grossProfitActual,
      netProfitActual,
      grossMarginPct,
      contributionAvailable: revenue != null && cogs != null,
      notes,
    },
    missing,
    evidence,
  };
}

export function formatFinanceForPrompt(snapshot: FinanceSnapshot): string {
  const lines: string[] = [`Currency: ${snapshot.currency}`];
  for (const [metric, vals] of Object.entries(snapshot.byMetric)) {
    if (vals.actual == null && vals.estimate == null && vals.projection == null) continue;
    lines.push(
      `- ${metricLabel(metric)}: actual=${vals.actual ?? "n/a"} | estimate=${vals.estimate ?? "n/a"} | projection=${vals.projection ?? "n/a"} (latest actual date: ${vals.latestActualDate || "n/a"})`,
    );
  }
  lines.push(
    `Derived gross profit actual: ${snapshot.derived.grossProfitActual ?? "n/a"}`,
    `Derived net profit actual: ${snapshot.derived.netProfitActual ?? "n/a"}`,
    `Gross margin %: ${snapshot.derived.grossMarginPct != null ? snapshot.derived.grossMarginPct.toFixed(2) : "n/a"}`,
  );
  if (snapshot.derived.notes.length) lines.push(`Notes: ${snapshot.derived.notes.join(" ")}`);
  if (snapshot.missing.length) lines.push(`Missing: ${snapshot.missing.join(" | ")}`);
  if (snapshot.evidence.length) lines.push(`Evidence: ${snapshot.evidence.join(" || ")}`);
  return lines.join("\n");
}
