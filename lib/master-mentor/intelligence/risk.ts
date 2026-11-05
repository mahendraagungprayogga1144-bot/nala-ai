import { buildFinancialIntelligence } from "./financial";
import { buildPerformanceAnalytics } from "./performance";
import { buildInventoryIntelligence } from "./inventory";
import type { BusinessFacts, RiskAlert } from "./types";

function alert(
  partial: Omit<RiskAlert, "detectionPeriod"> & { detectionPeriod?: string },
  periodLabel: string,
): RiskAlert {
  return {
    ...partial,
    detectionPeriod: partial.detectionPeriod || periodLabel,
  };
}

export function buildRiskAlerts(facts: BusinessFacts): RiskAlert[] {
  const perf = buildPerformanceAnalytics(facts);
  const fin = buildFinancialIntelligence(facts);
  const inv = buildInventoryIntelligence(facts);
  const period = facts.window.label;
  const out: RiskAlert[] = [];

  if (perf.salesGrowthPct != null && perf.salesGrowthPct <= -15) {
    out.push(
      alert(
        {
          id: "declining_revenue",
          issue: "Revenue menurun signifikan vs periode setara",
          supportingData: [
            `Growth ${perf.salesGrowthPct.toFixed(1)}%`,
            `Current ${perf.revenue.value}`,
            `Prior ${perf.revenuePrior.value}`,
          ],
          severity: perf.salesGrowthPct <= -30 ? "critical" : "high",
          recommendedAction: "Tinjau channel utama, stok unggulan, dan performa sales harian.",
          kind: "detected",
        },
        period,
      ),
    );
  }

  const netMargin = fin.netMarginPct.value;
  const grossMargin = fin.grossMarginPct.value;
  if (netMargin != null && netMargin < 5 && (perf.revenue.value || 0) > 0) {
    out.push(
      alert(
        {
          id: "thin_net_margin",
          issue: "Net margin rendah",
          supportingData: [`Net margin ${netMargin.toFixed(1)}%`, `Net profit ${fin.profitAndLoss.netProfit.value}`],
          severity: netMargin < 0 ? "critical" : "high",
          recommendedAction: "Periksa beban operasional dan HPP; tunda ekspansi jika kas tipis.",
          kind: "detected",
        },
        period,
      ),
    );
  }
  if (grossMargin != null && netMargin != null && grossMargin - netMargin > 25) {
    out.push(
      alert(
        {
          id: "opex_pressure",
          issue: "Gap gross vs net margin lebar (tekanan opex)",
          supportingData: [
            `Gross margin ${grossMargin.toFixed(1)}%`,
            `Net margin ${netMargin.toFixed(1)}%`,
          ],
          severity: "medium",
          recommendedAction: "Breakdown beban di Financial Intelligence; potong kategori biaya terbesar yang tidak produktif.",
          kind: "detected",
        },
        period,
      ),
    );
  }

  // Unusual expense: opex up >40% vs prior while revenue flat/down
  const opex = fin.profitAndLoss.operatingExpenses.value || 0;
  const priorOpex =
    facts.priorTransactions
      .filter((t) => t.type === "pengeluaran")
      .reduce((s, t) => s + t.amount, 0) +
    facts.priorSalesExpenses.reduce((s, e) => s + e.amount, 0);
  if (priorOpex > 0 && opex / priorOpex >= 1.4 && (perf.salesGrowthPct == null || perf.salesGrowthPct <= 5)) {
    out.push(
      alert(
        {
          id: "unusual_expense_increase",
          issue: "Kenaikan beban tidak wajar vs periode setara",
          supportingData: [`Opex current ${opex}`, `Opex prior ${priorOpex}`, `Δ ${(opex / priorOpex - 1) * 100}%`],
          severity: "high",
          recommendedAction: "Audit kategori pengeluaran terbesar pada periode ini.",
          kind: "detected",
        },
        period,
      ),
    );
  }

  if (fin.cashFlow.net.value != null && fin.cashFlow.net.value < 0) {
    out.push(
      alert(
        {
          id: "cash_flow_pressure",
          issue: "Net cash flow periode negatif",
          supportingData: [
            `Inflow ${fin.cashFlow.inflow.value}`,
            `Outflow ${fin.cashFlow.outflow.value}`,
            `Net ${fin.cashFlow.net.value}`,
          ],
          severity: fin.cashFlow.net.value < -((fin.cashFlow.inflow.value || 1) * 0.2) ? "high" : "medium",
          recommendedAction: "Tunda pengeluaran non-esensial; pastikan piutang/penagihan dan stok bergerak.",
          kind: "detected",
        },
        period,
      ),
    );
  }

  for (const low of inv.lowStock.slice(0, 8)) {
    out.push(
      alert(
        {
          id: `low_stock_${low.productId}`,
          issue: `Stok rendah: ${low.name}`,
          supportingData: [`Stock ${low.stock}`, `Threshold ${low.threshold}`],
          severity: low.stock <= 0 ? "critical" : "medium",
          recommendedAction: "Rencanakan restock — sistem tidak mengubah inventory otomatis.",
          kind: "detected",
        },
        period,
      ),
    );
  }

  if (perf.orderCountPrior.value && (perf.orderCount.value || 0) < (perf.orderCountPrior.value || 0) * 0.7) {
    out.push(
      alert(
        {
          id: "sales_deterioration",
          issue: "Jumlah order turun tajam vs periode setara",
          supportingData: [
            `Orders current ${perf.orderCount.value}`,
            `Orders prior ${perf.orderCountPrior.value}`,
          ],
          severity: "high",
          recommendedAction: "Cek kehadiran sales, stok unggulan, dan channel yang turun.",
          kind: "detected",
        },
        period,
      ),
    );
  }

  // Hypothesis only when data thin
  if (!facts.transactions.length && !facts.orders.length) {
    out.push(
      alert(
        {
          id: "insufficient_ops_data",
          issue: "Data operasional tidak memadai untuk deteksi risiko penuh",
          supportingData: facts.missingSources,
          severity: "low",
          recommendedAction: "Pastikan transaksi/order aktif dan portfolio tertaut ke Gercep business.",
          kind: "hypothesis",
        },
        period,
      ),
    );
  }

  return out;
}
