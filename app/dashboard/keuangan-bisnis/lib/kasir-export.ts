import * as XLSX from "xlsx";
import type { KasirExportContext, KasirExportKpis, KasirExportOrder } from "./kasir-export-types";
import { escapeHtml, fmtRpFull, formatWibNow, slugFilename } from "@/app/dashboard/inventory/lib/export-helpers";
import { formatTxDateLabel, formatTxTimeWib } from "@/lib/finance/sort-transactions";

const METODE: Record<string, string> = { tunai: "Tunai", qris: "QRIS", transfer: "Transfer" };

const PDF_STYLES = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #111; margin: 0; padding: 24px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2DD4BF; padding-bottom: 12px; margin-bottom: 16px; }
  .biz-name { font-size: 18px; font-weight: 700; }
  .brand { font-size: 11px; color: #666; margin-top: 4px; }
  .meta { text-align: right; font-size: 11px; color: #555; }
  h1 { text-align: center; font-size: 16px; letter-spacing: 0.06em; margin: 12px 0 4px; }
  .subtitle { text-align: center; font-size: 11px; color: #666; margin-bottom: 16px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; text-align: center; }
  .kpi-label { font-size: 9px; text-transform: uppercase; color: #666; }
  .kpi-value { font-size: 15px; font-weight: 700; margin-top: 4px; font-family: monospace; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 10px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; text-transform: uppercase; font-size: 9px; }
  td.num, th.num { text-align: right; font-family: monospace; }
  .total-row td { font-weight: 700; background: #f9fafb; }
  .footer { margin-top: 28px; font-size: 10px; color: #888; text-align: center; }
`;

export function computeKasirKpis(orders: KasirExportOrder[]): KasirExportKpis {
  const omzet = orders.reduce((s, o) => s + o.total, 0);
  const laba = orders.reduce((s, o) => s + Number(o.laba || 0), 0);
  const byMetode = (m: string) => orders.filter(o => o.metode_bayar === m).reduce((s, o) => s + o.total, 0);
  return {
    totalOrders: orders.length,
    omzet,
    laba,
    tunai: byMetode("tunai"),
    qris: byMetode("qris"),
    transfer: byMetode("transfer"),
  };
}

export function exportKasirExcel(orders: KasirExportOrder[], kpis: KasirExportKpis, ctx: KasirExportContext) {
  const rows = orders.map((o, i) => ({
    No: i + 1,
    "No. Nota": o.orderNo,
    Tanggal: formatTxDateLabel(o.order_date),
    Waktu: formatTxTimeWib(o.created_at) + " WIB",
    Kasir: o.kasirName,
    Menu: o.itemsSummary,
    Metode: METODE[o.metode_bayar || ""] || o.metode_bayar || "—",
    Diskon: o.diskon || 0,
    Total: o.total,
    Laba: Math.round(Number(o.laba || 0)),
    Catatan: o.catatan || "",
  }));

  const summary = [
    { Metrik: "Periode", Nilai: ctx.periodLabel },
    { Metrik: "Total Order", Nilai: kpis.totalOrders },
    { Metrik: "Omzet Kasir", Nilai: kpis.omzet },
    { Metrik: "Laba Kasir", Nilai: Math.round(kpis.laba) },
    { Metrik: "Tunai", Nilai: kpis.tunai },
    { Metrik: "QRIS", Nilai: kpis.qris },
    { Metrik: "Transfer", Nilai: kpis.transfer },
    { Metrik: "Dicetak", Nilai: formatWibNow() + " WIB" },
    { Metrik: "Bisnis", Nilai: ctx.businessName },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Transaksi Kasir");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Ringkasan");
  const date = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `transaksi-kasir-${slugFilename(ctx.businessName)}-${date}.xlsx`);
}

export function exportKasirPdfHtml(orders: KasirExportOrder[], kpis: KasirExportKpis, ctx: KasirExportContext): string {
  const rows = orders.map((o, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${escapeHtml(o.orderNo)}</td>
      <td>${escapeHtml(formatTxDateLabel(o.order_date))}<br/><span style="color:#666;font-size:9px">${formatTxTimeWib(o.created_at)} WIB</span></td>
      <td>${escapeHtml(o.kasirName)}</td>
      <td>${escapeHtml(o.itemsSummary)}</td>
      <td>${escapeHtml(METODE[o.metode_bayar || ""] || o.metode_bayar || "—")}</td>
      <td class="num">${fmtRpFull(o.total)}</td>
      <td class="num">${fmtRpFull(Number(o.laba || 0))}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${PDF_STYLES}</style></head><body>
    <div class="header">
      <div><div class="biz-name">${escapeHtml(ctx.businessName)}</div><div class="brand">Laporan Transaksi Kasir · Gercep AI</div></div>
      <div class="meta">Dicetak: ${formatWibNow()} WIB<br/>${escapeHtml(ctx.periodLabel)}</div>
    </div>
    <h1>TRANSAKSI KASIR</h1>
    <p class="subtitle">${escapeHtml(ctx.periodLabel)}</p>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Total Order</div><div class="kpi-value">${kpis.totalOrders}</div></div>
      <div class="kpi"><div class="kpi-label">Omzet</div><div class="kpi-value" style="color:#0d9488">${fmtRpFull(kpis.omzet)}</div></div>
      <div class="kpi"><div class="kpi-label">Laba</div><div class="kpi-value" style="color:#d97706">${fmtRpFull(Math.round(kpis.laba))}</div></div>
    </div>
    <table>
      <thead><tr>
        <th class="num">No</th><th>Nota</th><th>Waktu</th><th>Kasir</th><th>Menu</th><th>Bayar</th>
        <th class="num">Total</th><th class="num">Laba</th>
      </tr></thead>
      <tbody>${rows}
        <tr class="total-row">
          <td colspan="6" style="text-align:right">TOTAL</td>
          <td class="num">${fmtRpFull(kpis.omzet)}</td>
          <td class="num">${fmtRpFull(Math.round(kpis.laba))}</td>
        </tr>
      </tbody>
    </table>
    <div class="footer">Dicetak otomatis dari Gercep AI · ${formatWibNow()} WIB</div>
  </body></html>`;
}
