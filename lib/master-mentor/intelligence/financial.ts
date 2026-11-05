import { computeRetailHpp, computeRevenue, sumPengeluaran } from "./facts";
import { monthKey } from "./dates";
import type { BusinessFacts, MetricValue } from "./types";

function metric(
  value: number | null,
  certainty: MetricValue["certainty"],
  source: string[],
  missing?: string,
): MetricValue {
  return { value, certainty, source, missing };
}

export type FinancialIntelligence = {
  period: { from: string; to: string; label: string };
  profitAndLoss: {
    revenue: MetricValue;
    cogsOrHpp: MetricValue;
    grossProfit: MetricValue;
    operatingExpenses: MetricValue;
    salesModuleExpenses: MetricValue;
    netProfit: MetricValue;
  };
  cashFlow: {
    inflow: MetricValue;
    outflow: MetricValue;
    net: MetricValue;
    monthly: { month: string; inflow: number; outflow: number; net: number }[];
  };
  expenseBreakdown: { category: string; amount: number; source: string }[];
  grossMarginPct: MetricValue;
  netMarginPct: MetricValue;
  breakEven: {
    status: "computed" | "insufficient_data";
    fixedCosts: number | null;
    contributionPerUnit: number | null;
    unitsNeeded: number | null;
    notes: string[];
  };
  workingCapital: {
    status: "insufficient_data" | "proxy";
    cashBalance: number | null;
    notes: string[];
  };
  forecast: {
    nextPeriodRevenue: MetricValue;
    method: string;
    notes: string[];
  };
  missing: string[];
  notices: string[];
};

export function buildFinancialIntelligence(facts: BusinessFacts): FinancialIntelligence {
  const missing: string[] = [...facts.missingSources];
  const notices = [...facts.notices];

  const rev = computeRevenue(facts.transactions, facts.orders);
  const retailHpp = computeRetailHpp(facts.orders);
  const orderHpp = facts.orders.reduce((s, o) => s + (o.hpp || 0), 0);
  const hpp = retailHpp > 0 ? retailHpp : orderHpp;
  const opexLedger = sumPengeluaran(facts.transactions);
  const salesOpex = facts.salesExpenses.reduce((s, e) => s + e.amount, 0);
  const gross = (rev.value || 0) - hpp;
  const net = (rev.value || 0) - opexLedger - salesOpex - retailHpp;

  const grossMargin =
    rev.value && rev.value !== 0 ? (gross / rev.value) * 100 : null;
  const netMargin = rev.value && rev.value !== 0 ? (net / rev.value) * 100 : null;

  const expenseMap = new Map<string, { amount: number; source: string }>();
  for (const t of facts.transactions.filter((x) => x.type === "pengeluaran")) {
    const cat = (t.category || "Lainnya").trim() || "Lainnya";
    const cur = expenseMap.get(cat) || { amount: 0, source: "transactions" };
    cur.amount += t.amount;
    expenseMap.set(cat, cur);
  }
  for (const e of facts.salesExpenses) {
    const cat = (e.category || "Sales expense").trim() || "Sales expense";
    const cur = expenseMap.get(cat) || { amount: 0, source: "module_sales_expenses" };
    cur.amount += e.amount;
    expenseMap.set(cat, cur);
  }
  if (retailHpp > 0) {
    expenseMap.set("HPP AI Kasir (retail)", { amount: retailHpp, source: "orders.retail_kasir" });
  }
  const expenseBreakdown = [...expenseMap.entries()]
    .map(([category, v]) => ({ category, amount: v.amount, source: v.source }))
    .sort((a, b) => b.amount - a.amount);

  // Monthly cash flow within window from transactions (+ retail)
  const monthlyMap = new Map<string, { inflow: number; outflow: number }>();
  for (const t of facts.transactions) {
    const m = monthKey(t.transaction_date);
    const row = monthlyMap.get(m) || { inflow: 0, outflow: 0 };
    if (t.type === "pemasukan") row.inflow += t.amount;
    if (t.type === "pengeluaran") row.outflow += t.amount;
    monthlyMap.set(m, row);
  }
  for (const o of facts.orders) {
    if (o.source !== "retail_kasir" && !(o.catatan || "").toLowerCase().includes("ai kasir")) continue;
    const m = monthKey(o.order_date);
    const row = monthlyMap.get(m) || { inflow: 0, outflow: 0 };
    row.inflow += o.total;
    row.outflow += o.hpp || 0;
    monthlyMap.set(m, row);
  }
  const monthly = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      inflow: v.inflow,
      outflow: v.outflow,
      net: v.inflow - v.outflow,
    }));

  const cashIn = rev.value || 0;
  const cashOut = opexLedger + salesOpex + retailHpp;

  // Break-even: need fixed costs + contribution — only if we have AOV and margin
  const orderCount = facts.orders.length;
  const aov = orderCount > 0 ? (rev.value || 0) / orderCount : null;
  const variablePerOrder = orderCount > 0 ? hpp / orderCount : null;
  const contribution = aov != null && variablePerOrder != null ? aov - variablePerOrder : null;
  const fixedCosts = opexLedger + salesOpex;
  let breakEven: FinancialIntelligence["breakEven"];
  if (contribution != null && contribution > 0 && fixedCosts >= 0) {
    breakEven = {
      status: "computed",
      fixedCosts,
      contributionPerUnit: contribution,
      unitsNeeded: Math.ceil(fixedCosts / contribution),
      notes: [
        "Break-even memakai opex sebagai fixed cost proxy dan (AOV − HPP/order) sebagai kontribusi.",
        "Ini estimate operasional — bukan akuntansi formal.",
      ],
    };
  } else {
    breakEven = {
      status: "insufficient_data",
      fixedCosts: fixedCosts || null,
      contributionPerUnit: contribution,
      unitsNeeded: null,
      notes: ["Break-even tidak dihitung: kontribusi per order tidak cukup atau tidak ada order."],
    };
    missing.push("break_even");
  }

  // Working capital: no AR/AP/inventory valuation complete — proxy cash net only
  const workingCapital: FinancialIntelligence["workingCapital"] = {
    status: "proxy",
    cashBalance: cashIn - cashOut,
    notes: [
      "Working capital penuh (AR/AP/inventory) tidak tersedia sebagai ledger terpadu.",
      "Nilai proxy = net cash flow periode (actual), bukan saldo kas bank.",
    ],
  };

  // Forecast: simple average daily revenue × period length (labeled forecast)
  const days = Math.max(1, facts.window.days);
  const avgDaily = (rev.value || 0) / days;
  const forecastRevenue = avgDaily * days;
  const forecast: FinancialIntelligence["forecast"] = {
    nextPeriodRevenue: metric(forecastRevenue, "forecast", ["avg_daily_revenue × period_days"]),
    method: "naive_average_daily",
    notes: [
      "Forecast = rata-rata harian actual periode ini × panjang periode yang sama.",
      "Bukan prediksi model ML. Certainty = forecast.",
    ],
  };

  if (!(rev.value > 0)) missing.push("revenue");

  return {
    period: { from: facts.window.from, to: facts.window.to, label: facts.window.label },
    profitAndLoss: {
      revenue: metric(rev.value || 0, "actual", rev.source),
      cogsOrHpp: metric(hpp, "actual", ["orders.hpp"]),
      grossProfit: metric(gross, "actual", ["revenue − hpp"]),
      operatingExpenses: metric(opexLedger, "actual", ["transactions.pengeluaran"]),
      salesModuleExpenses: metric(salesOpex, "actual", ["module_sales_expenses"]),
      netProfit: metric(net, "actual", ["revenue − opex − sales_opex − retail_hpp"]),
    },
    cashFlow: {
      inflow: metric(cashIn, "actual", rev.source),
      outflow: metric(cashOut, "actual", ["pengeluaran", "sales_expenses", "retail_hpp"]),
      net: metric(cashIn - cashOut, "actual", ["inflow − outflow"]),
      monthly,
    },
    expenseBreakdown,
    grossMarginPct:
      grossMargin == null
        ? metric(null, "actual", [], "Margin kotor tidak dapat dihitung tanpa revenue.")
        : metric(grossMargin, "actual", ["gross/revenue"]),
    netMarginPct:
      netMargin == null
        ? metric(null, "actual", [], "Margin bersih tidak dapat dihitung tanpa revenue.")
        : metric(netMargin, "actual", ["net/revenue"]),
    breakEven,
    workingCapital,
    forecast,
    missing: [...new Set(missing)],
    notices,
  };
}
