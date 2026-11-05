import { computeRevenue } from "./facts";
import type { BusinessFacts } from "./types";

export type ProductPerf = {
  key: string;
  name: string;
  qty: number;
  revenue: number;
  hpp: number;
  profit: number | null;
};

export type GrowthIntelligence = {
  period: { from: string; to: string; label: string };
  revenueGrowthPct: number | null;
  products: ProductPerf[];
  topProducts: ProductPerf[];
  weakestProducts: ProductPerf[];
  channels: { channel: string; orders: number; revenue: number }[];
  pricingNotes: string[];
  opportunities: { title: string; evidence: string[]; kind: "evidence_based" | "hypothesis" }[];
  missing: string[];
  notices: string[];
};

export function buildGrowthIntelligence(facts: BusinessFacts): GrowthIntelligence {
  const missing = [...facts.missingSources];
  const notices = [...facts.notices];
  const rev = computeRevenue(facts.transactions, facts.orders);
  const revPrior = computeRevenue(facts.priorTransactions, facts.priorOrders);
  const revenueGrowthPct =
    (revPrior.value || 0) === 0
      ? rev.value === 0
        ? 0
        : null
      : (((rev.value || 0) - (revPrior.value || 0)) / Math.abs(revPrior.value || 1)) * 100;

  const map = new Map<string, ProductPerf>();
  for (const o of facts.orders) {
    if (!o.items.length) {
      const key = `order:${o.id}`;
      const cur = map.get(key) || {
        key,
        name: "Order tanpa item detail",
        qty: 1,
        revenue: o.total,
        hpp: o.hpp || 0,
        profit: o.laba,
      };
      map.set(key, cur);
      continue;
    }
    for (const it of o.items) {
      const key = it.product_id || it.product_name || "unknown";
      const name = it.product_name || key;
      const cur = map.get(key) || { key, name, qty: 0, revenue: 0, hpp: 0, profit: 0 };
      cur.qty += it.qty;
      cur.revenue += it.harga_jual * it.qty;
      cur.hpp += (it.hpp || 0) * it.qty;
      cur.profit = cur.revenue - cur.hpp;
      map.set(key, cur);
    }
  }
  const products = [...map.values()].sort((a, b) => b.revenue - a.revenue);
  if (!products.length) missing.push("product_line_items");

  const channelsMap = new Map<string, { orders: number; revenue: number }>();
  for (const o of facts.orders) {
    const channel =
      o.source === "henima_sales"
        ? "Henima Sales"
        : o.source === "retail_kasir"
          ? "AI Kasir"
          : o.source || "Orders (lain/F&B)";
    const cur = channelsMap.get(channel) || { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += o.total;
    channelsMap.set(channel, cur);
  }
  const channels = [...channelsMap.entries()].map(([channel, v]) => ({ channel, ...v }));

  const opportunities: GrowthIntelligence["opportunities"] = [];
  if (products.length) {
    const top = products[0];
    opportunities.push({
      title: `Pertahankan / scale produk unggulan: ${top.name}`,
      evidence: [`Revenue periode ${top.revenue}`, `Qty ${top.qty}`, `Sumber: order_items`],
      kind: "evidence_based",
    });
    const weak = [...products].filter((p) => p.qty > 0).sort((a, b) => a.revenue - b.revenue)[0];
    if (weak && weak.key !== top.key) {
      opportunities.push({
        title: `Tinjau produk lemah: ${weak.name}`,
        evidence: [`Revenue ${weak.revenue}`, `Qty ${weak.qty}`],
        kind: "evidence_based",
      });
    }
  }
  if (revenueGrowthPct != null && revenueGrowthPct < 0) {
    opportunities.push({
      title: "Revenue menurun vs periode setara — fokus recovery channel utama",
      evidence: [`Growth ${revenueGrowthPct.toFixed(1)}%`, `Current ${rev.value}`, `Prior ${revPrior.value}`],
      kind: "evidence_based",
    });
  }
  if (!facts.orders.length) {
    opportunities.push({
      title: "Belum ada data order untuk peluang pertumbuhan berbasis produk",
      evidence: [],
      kind: "hypothesis",
    });
  }

  const pricingNotes: string[] = [];
  const withMargin = products.filter((p) => p.profit != null && p.revenue > 0);
  if (withMargin.length) {
    const avgMargin =
      withMargin.reduce((s, p) => s + ((p.profit || 0) / p.revenue) * 100, 0) / withMargin.length;
    pricingNotes.push(`Rata-rata margin item (dari HPP item) ≈ ${avgMargin.toFixed(1)}%.`);
  } else {
    pricingNotes.push("Pricing opportunity terbatas: HPP per item tidak lengkap.");
    missing.push("item_hpp");
  }

  // Retention / acquisition not unified
  missing.push("customer_retention");
  missing.push("customer_acquisition_cost");

  return {
    period: { from: facts.window.from, to: facts.window.to, label: facts.window.label },
    revenueGrowthPct,
    products,
    topProducts: products.slice(0, 8),
    weakestProducts: [...products].sort((a, b) => a.revenue - b.revenue).slice(0, 5),
    channels,
    pricingNotes,
    opportunities,
    missing: [...new Set(missing)],
    notices,
  };
}
