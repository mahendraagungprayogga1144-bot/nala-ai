import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildFinancialIntelligence,
  buildPerformanceAnalytics,
  buildRiskAlerts,
  loadBusinessFacts,
  resolveIntelligencePeriod,
  resolveLinkedBusiness,
} from "../intelligence";
import { listPortfolioBusinesses } from "../portfolio-service";

export type BriefingKind = "daily" | "weekly";

export type BusinessBriefing = {
  kind: BriefingKind;
  generatedAt: string;
  timezone: "Asia/Jakarta";
  business: { mentorId: string; name: string; linked: boolean };
  sections: { heading: string; lines: string[] }[];
  missing: string[];
  text: string;
};

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "n/a";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

export async function buildBriefingForBusiness(
  db: SupabaseClient,
  ownerUserId: string,
  mentorBusinessId: string,
  kind: BriefingKind,
): Promise<BusinessBriefing> {
  const linked = await resolveLinkedBusiness(db, ownerUserId, mentorBusinessId);
  const period = kind === "daily" ? "yesterday" : "last_7_days";
  const window = resolveIntelligencePeriod(period);
  const facts = await loadBusinessFacts(db, linked, window);
  const perf = buildPerformanceAnalytics(facts);
  const fin = buildFinancialIntelligence(facts);
  const risks = buildRiskAlerts(facts);

  const sections: BusinessBriefing["sections"] = [
    {
      heading: kind === "daily" ? "Yesterday performance" : "Weekly performance",
      lines: [
        `Periode: ${window.label} (${window.from} → ${window.to})`,
        `Revenue: ${money(perf.revenue.value)}`,
        `Orders: ${perf.orderCount.value ?? "n/a"}`,
        `Growth vs prior: ${perf.salesGrowthPct == null ? "n/a" : `${perf.salesGrowthPct.toFixed(1)}%`}`,
        `Net profit: ${money(perf.netProfit.value)}`,
        `Expenses: ${money(perf.operatingExpenses.value)}`,
      ],
    },
    {
      heading: "Financial condition",
      lines: [
        `Gross margin: ${fin.grossMarginPct.value == null ? "n/a" : `${fin.grossMarginPct.value.toFixed(1)}%`}`,
        `Net margin: ${fin.netMarginPct.value == null ? "n/a" : `${fin.netMarginPct.value.toFixed(1)}%`}`,
        `Cash flow net: ${money(fin.cashFlow.net.value)}`,
      ],
    },
    {
      heading: "Alerts",
      lines: risks.length
        ? risks.slice(0, 8).map((r) => `[${r.severity}/${r.kind}] ${r.issue}`)
        : ["Tidak ada alert terdeteksi dari data tersedia."],
    },
    {
      heading: "Recommended actions",
      lines: risks.length
        ? risks.slice(0, 5).map((r) => r.recommendedAction)
        : ["Lanjutkan monitoring; lengkapi memory/link Gercep jika data tipis."],
    },
  ];

  const missing = [...new Set([...perf.missing, ...fin.missing, ...facts.missingSources])];
  const text = [
    `HENIMA AI ${kind === "daily" ? "Daily" : "Weekly"} Business Briefing`,
    `Business: ${linked.mentorBusinessName}`,
    `Timezone: Asia/Jakarta`,
    `Generated: ${new Date().toISOString()}`,
    "",
    ...sections.flatMap((s) => [`## ${s.heading}`, ...s.lines.map((l) => `- ${l}`), ""]),
    missing.length ? `Missing: ${missing.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    kind,
    generatedAt: new Date().toISOString(),
    timezone: "Asia/Jakarta",
    business: {
      mentorId: linked.mentorBusinessId,
      name: linked.mentorBusinessName,
      linked: linked.linked,
    },
    sections,
    missing,
    text,
  };
}

export async function buildBriefingsForOwner(
  db: SupabaseClient,
  ownerUserId: string,
  kind: BriefingKind,
): Promise<BusinessBriefing[]> {
  const { rows } = await listPortfolioBusinesses(db, ownerUserId);
  const active = rows.filter((r) => r.status === "active" || r.gercep_business_id);
  const out: BusinessBriefing[] = [];
  for (const b of active.slice(0, 10)) {
    out.push(await buildBriefingForBusiness(db, ownerUserId, b.id, kind));
  }
  return out;
}
