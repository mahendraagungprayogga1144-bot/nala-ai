import type { ExportContext, InventoryProductInput } from "./export-types";
import { computeInventoryKpis } from "./export-kpis";
import { mapProductsToExportRows } from "./export-mapper";
import { exportInventoryExcel } from "./export-excel";
import { exportInventoryPdfDetail, exportInventoryPdfRingkas } from "./export-pdf";
import { exportInventoryThermal } from "./export-thermal";

export type { ExportContext, InventoryProductInput, PdfVariant, PrintFormat } from "./export-types";
export { computeInventoryKpis } from "./export-kpis";
export { mapProductsToExportRows } from "./export-mapper";

export function prepareInventoryExport(products: InventoryProductInput[]) {
  const rows = mapProductsToExportRows(products);
  const kpis = computeInventoryKpis(products);
  return { rows, kpis };
}

export function runInventoryExcel(products: InventoryProductInput[], ctx: ExportContext) {
  const { rows, kpis } = prepareInventoryExport(products);
  if (rows.length === 0) return false;
  exportInventoryExcel(rows, kpis, ctx);
  return true;
}

export function runInventoryPdfRingkas(products: InventoryProductInput[], ctx: ExportContext): string | null {
  const { rows, kpis } = prepareInventoryExport(products);
  return exportInventoryPdfRingkas(rows, kpis, ctx);
}

export function runInventoryPdfDetail(products: InventoryProductInput[], ctx: ExportContext): string | null {
  const { rows, kpis } = prepareInventoryExport(products);
  return exportInventoryPdfDetail(rows, kpis, ctx);
}

export function runInventoryThermal(products: InventoryProductInput[], ctx: ExportContext, widthMm: number): string | null {
  const { rows, kpis } = prepareInventoryExport(products);
  return exportInventoryThermal(rows, kpis, ctx, widthMm);
}
