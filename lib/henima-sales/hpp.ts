import { SALES_ORDER_SOURCE, isSalesCatalogProduct } from "./types";
import type { SalesDb } from "./db";

export type CatalogCost = { id: string; name: string; cost: number };

export function catalogUnitCost(
  item: { product_id?: string | null; product_name_snapshot?: string | null },
  catalog: CatalogCost[],
  hint?: string | null,
): number {
  if (!catalog.length) return 0;
  const pid = item.product_id != null && String(item.product_id) !== "" ? String(item.product_id) : "";
  if (pid) {
    const byId = catalog.find((p) => p.id === pid);
    if (byId) return byId.cost;
  }
  const blob = `${item.product_name_snapshot || ""} ${hint || ""}`.toLowerCase();
  const hits = catalog.filter((p) => nameMatches(p.name, blob));
  if (hits.length === 1) return hits[0].cost;
  if (hits.length > 1) return averageCost(hits);
  if (/paket|pack|bundle/i.test(blob)) return averageCost(catalog);
  return 0;
}

function nameMatches(productName: string, blob: string) {
  const n = productName.toLowerCase().trim();
  if (!n || !blob.trim()) return false;
  if (blob.includes(n)) return true;
  const significant = n.split(/\s+/).filter((t) => t.length > 2 && t !== "the" && t !== "and");
  return significant.length > 0 && significant.every((t) => new RegExp(`\\b${escapeReg(t)}\\b`, "i").test(blob));
}

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function averageCost(products: CatalogCost[]) {
  if (!products.length) return 0;
  return Math.round(products.reduce((s, p) => s + p.cost, 0) / products.length);
}

export function lineHpp(
  item: {
    qty?: number | null;
    hpp?: number | null;
    product_id?: string | null;
    product_name_snapshot?: string | null;
  },
  catalog: CatalogCost[],
  hint?: string | null,
) {
  const qty = Number(item.qty || 0);
  const unit = Number(item.hpp) > 0 ? Number(item.hpp) : catalogUnitCost(item, catalog, hint);
  return unit * qty;
}

export function orderHppTotal(
  order: {
    hpp?: number | null;
    catatan?: string | null;
    order_items?: {
      qty?: number | null;
      hpp?: number | null;
      product_id?: string | null;
      product_name_snapshot?: string | null;
    }[];
  },
  catalog: CatalogCost[] = [],
) {
  const items = order.order_items || [];
  if (items.length) {
    return items.reduce((s, i) => s + lineHpp(i, catalog, order.catatan), 0);
  }
  return Number(order.hpp || 0);
}

export async function loadCatalogCosts(db: SalesDb, businessId: string): Promise<CatalogCost[]> {
  const { data, error } = await db
    .from("products")
    .select("id, name, cost, category")
    .eq("business_id", businessId);
  if (error) return [];
  return (data || [])
    .filter((p) => isSalesCatalogProduct(p) && Number(p.cost) > 0)
    .map((p) => ({ id: String(p.id), name: String(p.name || ""), cost: Number(p.cost) }));
}

type HealItem = {
  id: string;
  qty: number;
  harga_jual: number;
  product_id: string | null;
  product_name_snapshot: string | null;
  hpp: number | null;
};

/** Isi HPP/laba di order_items + header orders yang masih 0, dari modal katalog. */
export async function backfillMissingSaleHpp(db: SalesDb, businessId: string) {
  const catalog = await loadCatalogCosts(db, businessId);
  if (!catalog.length) return { items: 0, orders: 0 };

  const { data: orders, error } = await db
    .from("orders")
    .select("id, total, hpp, laba, catatan, order_items(id, qty, harga_jual, product_id, product_name_snapshot, hpp)")
    .eq("business_id", businessId)
    .eq("source", SALES_ORDER_SOURCE)
    .is("deleted_at", null);
  if (error || !orders?.length) return { items: 0, orders: 0 };

  let itemsUpdated = 0;
  let ordersUpdated = 0;

  for (const order of orders) {
    const items = (order.order_items || []) as HealItem[];
    let headerHpp = 0;
    for (const item of items) {
      const stored = Number(item.hpp || 0);
      const unit = stored > 0 ? stored : catalogUnitCost(item, catalog, order.catatan);
      headerHpp += unit * Number(item.qty || 0);
      if (stored > 0 || !(unit > 0)) continue;
      const qty = Number(item.qty || 0);
      const price = Number(item.harga_jual || 0);
      const { error: itemErr } = await db
        .from("order_items")
        .update({
          hpp: unit,
          laba: (price - unit) * qty,
        })
        .eq("id", item.id);
      if (!itemErr) itemsUpdated += 1;
    }
    if (!(headerHpp > 0)) continue;
    if (Number(order.hpp || 0) > 0 && Number(order.laba) === Number(order.total) - Number(order.hpp)) continue;
    const { error: orderErr } = await db
      .from("orders")
      .update({
        hpp: headerHpp,
        laba: Number(order.total || 0) - headerHpp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (!orderErr) ordersUpdated += 1;
  }

  return { items: itemsUpdated, orders: ordersUpdated };
}
