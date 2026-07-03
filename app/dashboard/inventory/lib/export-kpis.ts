import type { InventoryKpis, InventoryProductInput } from "./export-types";
import { getStockStatus } from "./export-mapper";

export function computeInventoryKpis(products: InventoryProductInput[]): InventoryKpis {
  let stokMenipis = 0;
  let stokHabis = 0;
  let stokTersedia = 0;
  let totalNilaiStok = 0;

  for (const p of products) {
    const status = getStockStatus(p.stock, p.min_stock);
    if (status === "menipis") stokMenipis++;
    if (status === "habis") stokHabis++;
    if (p.stock > 0) stokTersedia += p.stock;
    totalNilaiStok += (p.cost ?? 0) * p.stock;
  }

  return {
    totalItem: products.length,
    stokTersedia,
    stokMenipis,
    stokHabis,
    totalNilaiStok,
  };
}
