import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveIntelligencePeriod, type IntelligencePeriod } from "./dates";
import { loadBusinessFacts } from "./facts";
import { buildFinancialIntelligence } from "./financial";
import { buildPerformanceAnalytics } from "./performance";
import { resolveLinkedBusiness } from "./resolve-business";

export type BusinessComparisonRow = {
  mentorBusinessId: string;
  mentorName: string;
  gercepBusinessId: string | null;
  linked: boolean;
  revenue: number | null;
  netProfit: number | null;
  netMarginPct: number | null;
  operatingExpenses: number | null;
  growthPct: number | null;
  capitalEfficiency: number | null;
  notes: string[];
  missing: string[];
};

/**
 * Compare multiple mentor portfolio businesses.
 * Only comparable metrics with clear sources; unlinked businesses marked missing.
 */
export async function compareBusinesses(
  db: SupabaseClient,
  ownerUserId: string,
  mentorBusinessIds: string[],
  period: IntelligencePeriod,
  custom?: { from?: string; to?: string },
): Promise<{ rows: BusinessComparisonRow[]; notices: string[] }> {
  const window = resolveIntelligencePeriod(period, custom);
  const notices: string[] = [
    "Perbandingan memakai periode yang sama untuk setiap bisnis.",
    "Jangan bandingkan margin lintas model bisnis tanpa membaca notes (F&B vs retail vs wholesale berbeda struktur biaya).",
  ];
  const rows: BusinessComparisonRow[] = [];

  for (const id of mentorBusinessIds.slice(0, 8)) {
    const linked = await resolveLinkedBusiness(db, ownerUserId, id);
    if (!linked.linked) {
      rows.push({
        mentorBusinessId: linked.mentorBusinessId,
        mentorName: linked.mentorBusinessName,
        gercepBusinessId: null,
        linked: false,
        revenue: null,
        netProfit: null,
        netMarginPct: null,
        operatingExpenses: null,
        growthPct: null,
        capitalEfficiency: null,
        notes: ["Belum tertaut ke Gercep business — metrik operasional tidak tersedia."],
        missing: ["gercep_link"],
      });
      continue;
    }
    const facts = await loadBusinessFacts(db, linked, window);
    const perf = buildPerformanceAnalytics(facts);
    const fin = buildFinancialIntelligence(facts);
    const revenue = perf.revenue.value;
    const net = fin.profitAndLoss.netProfit.value;
    const opex = fin.profitAndLoss.operatingExpenses.value;
    const capitalEfficiency =
      opex != null && opex !== 0 && revenue != null ? revenue / opex : null;

    rows.push({
      mentorBusinessId: linked.mentorBusinessId,
      mentorName: linked.mentorBusinessName,
      gercepBusinessId: linked.gercepBusinessId,
      linked: true,
      revenue,
      netProfit: net,
      netMarginPct: fin.netMarginPct.value,
      operatingExpenses: opex,
      growthPct: perf.salesGrowthPct,
      capitalEfficiency,
      notes: [
        `Periode ${window.label}`,
        "Capital efficiency proxy = revenue / operating expenses (bukan ROI modal penuh).",
      ],
      missing: [...new Set([...perf.missing, ...fin.missing])],
    });
  }

  return { rows, notices };
}
