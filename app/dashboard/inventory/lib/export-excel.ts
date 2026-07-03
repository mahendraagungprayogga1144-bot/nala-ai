import * as XLSX from "xlsx";
import type { ExportContext, ExportProductRow, InventoryKpis } from "./export-types";
import { fmtRpFull, formatWibNow, slugFilename } from "./export-helpers";

export function exportInventoryExcel(
  rows: ExportProductRow[],
  kpis: InventoryKpis,
  ctx: ExportContext,
) {
  const detailRows = rows.map(r => ({
    No: r.no,
    Kode: r.kode,
    Nama: r.nama,
    Kategori: r.kategori,
    Satuan: r.satuan,
    Stok: r.stok,
    "Min. Stok": r.minStok,
    "Harga Beli": r.hargaBeli,
    "Harga Jual": r.hargaJual,
    "Nilai Stok": r.nilaiStok,
    Status: r.statusLabel,
  }));

  const summaryRows = [
    { Metrik: "Total Item", Nilai: kpis.totalItem },
    { Metrik: "Stok Tersedia (unit)", Nilai: kpis.stokTersedia },
    { Metrik: "Stok Menipis", Nilai: kpis.stokMenipis },
    { Metrik: "Stok Habis", Nilai: kpis.stokHabis },
    { Metrik: "Total Nilai Stok", Nilai: kpis.totalNilaiStok },
    { Metrik: "Dicetak", Nilai: formatWibNow() },
    { Metrik: "Bisnis", Nilai: ctx.businessName },
    ...(ctx.filterLabel ? [{ Metrik: "Filter", Nilai: ctx.filterLabel }] : []),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "Stok");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Ringkasan");
  const date = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `rekapan-stok-${slugFilename(ctx.businessName)}-${date}.xlsx`);
}
