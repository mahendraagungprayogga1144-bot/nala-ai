import { computeRetailHpp, computeRevenue, sumPengeluaran } from "./facts";
import type { BusinessFacts, MetricValue } from "./types";

function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function metric(value: number, source: string[]): MetricValue {
  return { value, certainty: "actual", source };
}

export type PerformanceAnalytics = {
  period: { from: string; to: string; label: string; compareFrom: string; compareTo: string };
  revenue: MetricValue;
  revenuePrior: MetricValue;
  salesGrowthPct: number | null;
  orderCount: MetricValue;
  orderCountPrior: MetricValue;
  averageOrderValue: MetricValue;
  averageOrderValuePrior: MetricValue;
  grossProfit: MetricValue;
  netProfit: MetricValue;
  operatingExpenses: MetricValue;
  conversionRate: MetricValue;
  trendDaily: { date: string; revenue: number; expenses: number; orders: number }[];
  missing: string[];
  notices: string[];
};

export function buildPerformanceAnalytics(facts: BusinessFacts): PerformanceAnalytics {
  const missing: string[] = [...facts.missingSources];
  const notices = [...facts.notices];

  const rev = computeRevenue(facts.transactions, facts.orders);
  const revPrior = computeRevenue(facts.priorTransactions, facts.priorOrders);
  const orderCount = facts.orders.length;
  const orderCountPrior = facts.priorOrders.length;

  const opexLedger = sumPengeluaran(facts.transactions);
  const opexSales = facts.salesExpenses.reduce((s, e) => s + e.amount, 0);
  const retailHpp = computeRetailHpp(facts.orders);
  const operatingExpenses = opexLedger + opexSales;
  const totalBurden = operatingExpenses + retailHpp;

  const orderLabaSum = facts.orders.reduce((s, o) => s + (o.laba != null ? Number(o.laba) : 0), 0);
  const hasOrderLaba = facts.orders.some((o) => o.laba != null);
  let grossProfit: number | null = null;
  const grossSource: string[] = [];
  if (hasOrderLaba) {
    grossProfit = orderLabaSum;
    grossSource.push("orders.laba");
  } else {
    grossProfit = (rev.value || 0) - retailHpp;
    grossSource.push(...rev.source, "orders.hpp(retail_kasir)");
  }

  // Align with Analitik: revenue − (ledger pengeluaran + sales opex + retail HPP)
  const netAnalitik = (rev.value || 0) - totalBurden;
  const netPrior =
    (revPrior.value || 0) -
    (sumPengeluaran(facts.priorTransactions) +
      facts.priorSalesExpenses.reduce((s, e) => s + e.amount, 0) +
      computeRetailHpp(facts.priorOrders));

  const aov = orderCount > 0 ? (rev.value || 0) / orderCount : null;
  const aovPrior = orderCountPrior > 0 ? (revPrior.value || 0) / orderCountPrior : null;

  const conversionRate: MetricValue = {
    value: null,
    certainty: "actual",
    source: [],
    missing: "Conversion rate tidak tersedia — tidak ada funnel sitewide di Gercep OS.",
  };
  missing.push("conversion_rate");

  const days: Record<string, { revenue: number; expenses: number; orders: number }> = {};
  for (const t of facts.transactions) {
    const d = t.transaction_date;
    if (!days[d]) days[d] = { revenue: 0, expenses: 0, orders: 0 };
    if (t.type === "pemasukan") days[d].revenue += t.amount;
    if (t.type === "pengeluaran") days[d].expenses += t.amount;
  }
  for (const o of facts.orders) {
    const d = o.order_date;
    if (!days[d]) days[d] = { revenue: 0, expenses: 0, orders: 0 };
    days[d].orders += 1;
    if (o.source === "retail_kasir" || (o.catatan || "").toLowerCase().includes("ai kasir")) {
      days[d].revenue += o.total;
      days[d].expenses += o.hpp || 0;
    }
  }
  const trendDaily = Object.keys(days)
    .sort()
    .map((date) => ({ date, ...days[date] }));

  void netPrior;

  return {
    period: {
      from: facts.window.from,
      to: facts.window.to,
      label: facts.window.label,
      compareFrom: facts.prior.from,
      compareTo: facts.prior.to,
    },
    revenue: metric(rev.value || 0, rev.source),
    revenuePrior: metric(revPrior.value || 0, revPrior.source),
    salesGrowthPct: pctChange(rev.value || 0, revPrior.value || 0),
    orderCount: metric(orderCount, ["orders"]),
    orderCountPrior: metric(orderCountPrior, ["orders"]),
    averageOrderValue:
      aov == null
        ? { value: null, certainty: "actual", source: [], missing: "Tidak ada order pada periode ini." }
        : metric(aov, ["revenue/orders"]),
    averageOrderValuePrior:
      aovPrior == null
        ? { value: null, certainty: "actual", source: [] }
        : metric(aovPrior, ["revenue/orders"]),
    grossProfit: metric(grossProfit, grossSource),
    netProfit: metric(netAnalitik, ["revenue − (pengeluaran + retail hpp + sales expenses)"]),
    operatingExpenses: metric(operatingExpenses, ["transactions.pengeluaran", "module_sales_expenses"]),
    conversionRate,
    trendDaily,
    missing: [...new Set(missing)],
    notices,
  };
}
