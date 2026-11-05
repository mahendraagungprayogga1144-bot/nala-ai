import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveIntelligencePeriod, type IntelligencePeriod } from "./dates";
import { loadBusinessFacts } from "./facts";
import { buildFinancialIntelligence } from "./financial";
import { buildGrowthIntelligence } from "./growth";
import { buildInventoryIntelligence } from "./inventory";
import { buildPeopleAnalytics } from "./people";
import { buildPerformanceAnalytics } from "./performance";
import { buildRiskAlerts } from "./risk";
import { resolveLinkedBusiness } from "./resolve-business";
import type { IntelligencePack } from "./types";

/** Compact intelligence pack for Master Mentor prompts — facts only, no invented numbers. */
export async function buildIntelligencePack(
  db: SupabaseClient,
  ownerUserId: string,
  mentorBusinessId: string | null | undefined,
  period: IntelligencePeriod = "last_30_days",
): Promise<IntelligencePack> {
  if (!mentorBusinessId) {
    return {
      linked: false,
      notices: ["Tidak ada business context — intelligence operasional tidak dimuat."],
      missing: ["business_id"],
    };
  }

  const linked = await resolveLinkedBusiness(db, ownerUserId, mentorBusinessId);
  if (!linked.linked) {
    return {
      linked: false,
      notices: [
        `Portfolio "${linked.mentorBusinessName}" belum ditautkan ke bisnis Gercep.`,
        "Tautkan gercep_business_id di Business Portfolio untuk analisis operasional.",
      ],
      missing: ["gercep_link"],
    };
  }

  const window = resolveIntelligencePeriod(period);
  const facts = await loadBusinessFacts(db, linked, window);
  const performance = buildPerformanceAnalytics(facts);
  const financial = buildFinancialIntelligence(facts);
  const growth = buildGrowthIntelligence(facts);
  const inventory = buildInventoryIntelligence(facts);
  const people = buildPeopleAnalytics(facts);
  const risks = buildRiskAlerts(facts);

  return {
    linked: true,
    notices: facts.notices,
    missing: [
      ...new Set([
        ...performance.missing,
        ...financial.missing,
        ...growth.missing,
        ...inventory.missing,
        ...people.missing,
      ]),
    ],
    performance: {
      period: performance.period,
      revenue: performance.revenue,
      salesGrowthPct: performance.salesGrowthPct,
      orderCount: performance.orderCount,
      aov: performance.averageOrderValue,
      netProfit: performance.netProfit,
    },
    financial: {
      grossMarginPct: financial.grossMarginPct,
      netMarginPct: financial.netMarginPct,
      cashFlowNet: financial.cashFlow.net,
      topExpenses: financial.expenseBreakdown.slice(0, 5),
      breakEven: financial.breakEven,
      forecastRevenue: financial.forecast.nextPeriodRevenue,
    },
    growth: {
      topProducts: growth.topProducts.slice(0, 5),
      channels: growth.channels,
      opportunities: growth.opportunities.slice(0, 5),
    },
    inventory: {
      lowStock: inventory.lowStock.slice(0, 8),
      fastMoving: inventory.fastMoving.slice(0, 5),
      turnover: inventory.turnover,
    },
    people: {
      headcountActive: people.headcountActive,
      revenuePerEmployee: people.revenuePerEmployee,
      topSales: people.salesPerformance.slice(0, 5),
      attendance: people.attendance,
      caveats: people.caveats,
    },
    risks: risks.slice(0, 10),
  };
}

export function formatIntelligencePackForPrompt(pack: IntelligencePack): string {
  if (!pack.linked) {
    return [
      "PHASE 4 OPERATIONAL INTELLIGENCE: tidak tertaut.",
      ...pack.notices,
      `Missing: ${pack.missing.join(" | ") || "—"}`,
    ].join("\n");
  }
  return [
    "PHASE 4 OPERATIONAL INTELLIGENCE (calculated — jangan mengarang angka di luar ini):",
    JSON.stringify(
      {
        performance: pack.performance,
        financial: pack.financial,
        growth: pack.growth,
        inventory: pack.inventory,
        people: pack.people,
        risks: pack.risks,
        missing: pack.missing,
        notices: pack.notices,
      },
      null,
      0,
    ),
  ].join("\n");
}
