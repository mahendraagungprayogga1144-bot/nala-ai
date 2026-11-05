import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildPeopleAnalytics,
  buildPerformanceAnalytics,
  loadBusinessFacts,
  resolveIntelligencePeriod,
  resolveLinkedBusiness,
} from "../intelligence";
import { listPortfolioBusinesses } from "../portfolio-service";

export type SalesMonitorReport = {
  businessId: string;
  businessName: string;
  period: string;
  revenue: number | null;
  orders: number | null;
  growthPct: number | null;
  topSales: { name: string; revenue: number; orders: number }[];
  alerts: string[];
  missing: string[];
};

/** Read-only sales monitoring — never mutates commission/salary/orders. */
export async function buildSalesMonitorForOwner(
  db: SupabaseClient,
  ownerUserId: string,
): Promise<SalesMonitorReport[]> {
  const { rows } = await listPortfolioBusinesses(db, ownerUserId);
  const window = resolveIntelligencePeriod("today");
  const out: SalesMonitorReport[] = [];

  for (const b of rows.slice(0, 10)) {
    const linked = await resolveLinkedBusiness(db, ownerUserId, b.id);
    if (!linked.linked) {
      out.push({
        businessId: b.id,
        businessName: b.name,
        period: window.label,
        revenue: null,
        orders: null,
        growthPct: null,
        topSales: [],
        alerts: ["Belum tertaut ke Gercep business."],
        missing: ["gercep_link"],
      });
      continue;
    }
    const facts = await loadBusinessFacts(db, linked, window);
    const perf = buildPerformanceAnalytics(facts);
    const people = buildPeopleAnalytics(facts);
    const alerts: string[] = [];
    if ((perf.orderCount.value || 0) === 0) alerts.push("Belum ada order hari ini (data aktual).");
    if (perf.salesGrowthPct != null && perf.salesGrowthPct < -20) {
      alerts.push(`Pertumbuhan vs prior window ${perf.salesGrowthPct.toFixed(1)}%.`);
    }
    out.push({
      businessId: b.id,
      businessName: b.name,
      period: window.label,
      revenue: perf.revenue.value,
      orders: perf.orderCount.value,
      growthPct: perf.salesGrowthPct,
      topSales: people.salesPerformance.slice(0, 5).map((s) => ({
        name: s.name,
        revenue: s.revenue,
        orders: s.orders,
      })),
      alerts,
      missing: [...new Set([...perf.missing, ...people.missing])],
    });
  }
  return out;
}
