import type { ExportProductRow, InventoryProductInput, StockStatus } from "./export-types";

const STATUS_LABEL: Record<StockStatus, string> = {
  aman: "Aman",
  menipis: "Menipis",
  habis: "Habis",
};

export function getStockStatus(stock: number, minStock: number): StockStatus {
  if (stock <= 0) return "habis";
  if (stock <= minStock) return "menipis";
  return "aman";
}

export function mapProductsToExportRows(products: InventoryProductInput[]): ExportProductRow[] {
  return products.map((p, i) => {
    const status = getStockStatus(p.stock, p.min_stock);
    const hargaBeli = p.cost ?? 0;
    const hargaJual = p.price ?? 0;
    return {
      no: i + 1,
      kode: p.sku || "-",
      nama: p.name,
      kategori: p.category || "Lainnya",
      satuan: p.unit || "unit",
      stok: p.stock,
      minStok: p.min_stock,
      hargaBeli,
      hargaJual,
      nilaiStok: hargaBeli * p.stock,
      status,
      statusLabel: STATUS_LABEL[status],
    };
  });
}

export function sortByLowStockFirst(rows: ExportProductRow[]): ExportProductRow[] {
  const priority: Record<StockStatus, number> = { habis: 0, menipis: 1, aman: 2 };
  return [...rows].sort((a, b) => {
    const pd = priority[a.status] - priority[b.status];
    if (pd !== 0) return pd;
    return a.stok - b.stok;
  });
}
