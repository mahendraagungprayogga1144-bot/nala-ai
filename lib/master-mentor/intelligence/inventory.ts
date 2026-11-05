import type { BusinessFacts } from "./types";

export type InventoryIntelligence = {
  period: { from: string; to: string; label: string };
  currentStock: { productId: string; name: string; stock: number; cost: number | null; price: number | null }[];
  lowStock: { productId: string; name: string; stock: number; threshold: number }[];
  movement: { productId: string | null; change: number; reason: string | null; at: string }[];
  fastMoving: { key: string; name: string; qtySold: number }[];
  slowMoving: { productId: string; name: string; stock: number; qtySold: number }[];
  turnover: {
    status: "computed" | "insufficient_data";
    cogsProxy: number | null;
    avgInventoryValue: number | null;
    turns: number | null;
    notes: string[];
  };
  depletionEstimates: {
    productId: string;
    name: string;
    stock: number;
    dailySalesQty: number | null;
    daysRemaining: number | null;
    certainty: "estimate" | "insufficient_data";
  }[];
  missing: string[];
  notices: string[];
};

const LOW_STOCK_THRESHOLD = 5;

export function buildInventoryIntelligence(facts: BusinessFacts): InventoryIntelligence {
  const missing = [...facts.missingSources];
  const notices = [...facts.notices];

  const soldQty = new Map<string, { name: string; qty: number }>();
  for (const o of facts.orders) {
    for (const it of o.items) {
      const key = it.product_id || it.product_name || "unknown";
      const cur = soldQty.get(key) || { name: it.product_name || key, qty: 0 };
      cur.qty += it.qty;
      soldQty.set(key, cur);
    }
  }

  const currentStock = facts.products.map((p) => ({
    productId: p.id,
    name: p.name,
    stock: p.stock,
    cost: p.cost,
    price: p.price,
  }));
  if (!currentStock.length) missing.push("products");

  const lowStock = currentStock
    .filter((p) => p.stock <= LOW_STOCK_THRESHOLD)
    .map((p) => ({
      productId: p.productId,
      name: p.name,
      stock: p.stock,
      threshold: LOW_STOCK_THRESHOLD,
    }));

  const movement = facts.stockMoves.slice(0, 100).map((m) => ({
    productId: m.product_id,
    change: m.change,
    reason: m.reason,
    at: m.created_at,
  }));

  const fastMoving = [...soldQty.entries()]
    .map(([key, v]) => ({ key, name: v.name, qtySold: v.qty }))
    .sort((a, b) => b.qtySold - a.qtySold)
    .slice(0, 10);

  const slowMoving = currentStock
    .map((p) => ({
      productId: p.productId,
      name: p.name,
      stock: p.stock,
      qtySold: soldQty.get(p.productId)?.qty || 0,
    }))
    .filter((p) => p.stock > 0 && p.qtySold === 0)
    .slice(0, 15);

  const cogsProxy = facts.orders.reduce((s, o) => s + (o.hpp || 0), 0);
  const invValue = facts.products.reduce((s, p) => s + p.stock * (p.cost || 0), 0);
  let turnover: InventoryIntelligence["turnover"];
  if (cogsProxy > 0 && invValue > 0) {
    turnover = {
      status: "computed",
      cogsProxy,
      avgInventoryValue: invValue,
      turns: cogsProxy / invValue,
      notes: [
        "Turnover = HPP order periode / nilai stok saat ini (cost × qty).",
        "Ini proxy — bukan rata-rata inventori periodik formal.",
      ],
    };
  } else {
    turnover = {
      status: "insufficient_data",
      cogsProxy: cogsProxy || null,
      avgInventoryValue: invValue || null,
      turns: null,
      notes: ["Inventory turnover tidak dihitung: HPP order atau nilai stok (cost) tidak memadai."],
    };
    missing.push("inventory_turnover");
  }

  const days = Math.max(1, facts.window.days);
  const depletionEstimates = currentStock.slice(0, 40).map((p) => {
    const sold = soldQty.get(p.productId)?.qty || 0;
    if (sold <= 0) {
      return {
        productId: p.productId,
        name: p.name,
        stock: p.stock,
        dailySalesQty: null,
        daysRemaining: null,
        certainty: "insufficient_data" as const,
      };
    }
    const daily = sold / days;
    return {
      productId: p.productId,
      name: p.name,
      stock: p.stock,
      dailySalesQty: daily,
      daysRemaining: daily > 0 ? p.stock / daily : null,
      certainty: "estimate" as const,
    };
  });

  return {
    period: { from: facts.window.from, to: facts.window.to, label: facts.window.label },
    currentStock,
    lowStock,
    movement,
    fastMoving,
    slowMoving,
    turnover,
    depletionEstimates,
    missing: [...new Set(missing)],
    notices,
  };
}
