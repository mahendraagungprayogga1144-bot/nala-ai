import type { BusinessFacts } from "./types";
import { buildFinancialIntelligence } from "./financial";
import { buildGrowthIntelligence } from "./growth";
import { buildInventoryIntelligence } from "./inventory";
import { buildPeopleAnalytics } from "./people";
import { buildPerformanceAnalytics } from "./performance";
import { buildRiskAlerts } from "./risk";

export type ReportKind =
  | "daily"
  | "weekly"
  | "monthly"
  | "financial"
  | "risk";

export type BusinessReport = {
  kind: ReportKind;
  title: string;
  generatedAt: string;
  period: { from: string; to: string; label: string };
  business: { mentorId: string | null; mentorName: string | null; gercepId: string; gercepName: string };
  sections: { heading: string; lines: string[] }[];
  missing: string[];
  exportText: string;
};

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "n/a";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

export function buildBusinessReport(facts: BusinessFacts, kind: ReportKind): BusinessReport {
  const perf = buildPerformanceAnalytics(facts);
  const fin = buildFinancialIntelligence(facts);
  const growth = buildGrowthIntelligence(facts);
  const people = buildPeopleAnalytics(facts);
  const inv = buildInventoryIntelligence(facts);
  const risks = buildRiskAlerts(facts);

  const titles: Record<ReportKind, string> = {
    daily: "Daily Business Report",
    weekly: "Weekly Business Report",
    monthly: "Monthly Business Report",
    financial: "Financial Performance Report",
    risk: "Business Risk Report",
  };

  const sections: BusinessReport["sections"] = [];

  if (kind !== "risk") {
    sections.push({
      heading: "Performance",
      lines: [
        `Revenue (actual): ${money(perf.revenue.value)} [${perf.revenue.source.join(", ")}]`,
        `Orders: ${perf.orderCount.value}`,
        `AOV: ${money(perf.averageOrderValue.value)}`,
        `Growth vs prior: ${perf.salesGrowthPct == null ? "n/a" : `${perf.salesGrowthPct.toFixed(1)}%`}`,
        `Net profit (actual): ${money(perf.netProfit.value)}`,
      ],
    });
  }

  if (kind === "financial" || kind === "monthly" || kind === "weekly") {
    sections.push({
      heading: "Financial",
      lines: [
        `Gross margin: ${fin.grossMarginPct.value == null ? "n/a" : `${fin.grossMarginPct.value.toFixed(1)}%`}`,
        `Net margin: ${fin.netMarginPct.value == null ? "n/a" : `${fin.netMarginPct.value.toFixed(1)}%`}`,
        `Cash flow net: ${money(fin.cashFlow.net.value)}`,
        `Top expense: ${fin.expenseBreakdown[0] ? `${fin.expenseBreakdown[0].category} ${money(fin.expenseBreakdown[0].amount)}` : "n/a"}`,
        `Forecast next period revenue (${fin.forecast.nextPeriodRevenue.certainty}): ${money(fin.forecast.nextPeriodRevenue.value)}`,
      ],
    });
  }

  if (kind !== "financial" && kind !== "risk") {
    sections.push({
      heading: "Growth & people",
      lines: [
        `Top product: ${growth.topProducts[0]?.name || "n/a"}`,
        `Channels: ${growth.channels.map((c) => `${c.channel}=${money(c.revenue)}`).join("; ") || "n/a"}`,
        `Active staff: ${people.headcountActive}`,
        `Rev/employee: ${money(people.revenuePerEmployee)}`,
      ],
    });
    sections.push({
      heading: "Inventory",
      lines: [
        `SKUs: ${inv.currentStock.length}`,
        `Low stock alerts: ${inv.lowStock.length}`,
        `Turnover: ${inv.turnover.turns == null ? inv.turnover.status : inv.turnover.turns.toFixed(2)}`,
      ],
    });
  }

  if (kind === "risk" || kind === "monthly" || kind === "weekly") {
    sections.push({
      heading: "Risks",
      lines: risks.length
        ? risks.slice(0, 12).map(
            (r) =>
              `[${r.kind}/${r.severity}] ${r.issue} — ${r.supportingData.join("; ")} → ${r.recommendedAction}`,
          )
        : ["Tidak ada alert terdeteksi pada periode ini."],
    });
  }

  const missing = [
    ...new Set([
      ...perf.missing,
      ...fin.missing,
      ...growth.missing,
      ...people.missing,
      ...inv.missing,
    ]),
  ];

  const exportText = [
    titles[kind],
    `Business: ${facts.gercepBusinessName || facts.mentorBusinessName || "—"}`,
    `Period: ${facts.window.label} (${facts.window.from} → ${facts.window.to})`,
    `Generated: ${new Date().toISOString()}`,
    "",
    ...sections.flatMap((s) => [`## ${s.heading}`, ...s.lines.map((l) => `- ${l}`), ""]),
    missing.length ? `Missing: ${missing.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    kind,
    title: titles[kind],
    generatedAt: new Date().toISOString(),
    period: { from: facts.window.from, to: facts.window.to, label: facts.window.label },
    business: {
      mentorId: facts.mentorBusinessId,
      mentorName: facts.mentorBusinessName,
      gercepId: facts.gercepBusinessId,
      gercepName: facts.gercepBusinessName,
    },
    sections,
    missing,
    exportText,
  };
}
