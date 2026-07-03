import type { KasirExportKpis, KasirExportOrder } from "@/app/dashboard/keuangan-bisnis/lib/kasir-export-types";
import { exportKasirPdfHtml, exportKasirExcel } from "@/app/dashboard/keuangan-bisnis/lib/kasir-export";
import { escapeHtml, fmtRpFull, formatWibNow } from "@/app/dashboard/inventory/lib/export-helpers";

export type DayCloseData = {
  businessName: string;
  tanggal: string;
  orders: KasirExportOrder[];
  kpis: KasirExportKpis;
  activeKasir: { nama: string; jamMasuk: string; orderCount: number; omzet: number }[];
};

export function buildDayClosePdfHtml(data: DayCloseData): string {
  const ctx = { businessName: data.businessName, periodLabel: `Tutup hari · ${data.tanggal}` };
  const base = exportKasirPdfHtml(data.orders, data.kpis, ctx);
  const kasirRows = data.activeKasir.map(k => `
    <tr><td>${escapeHtml(k.nama)}</td><td>${escapeHtml(k.jamMasuk)}</td><td class="num">${k.orderCount}</td><td class="num">${fmtRpFull(k.omzet)}</td></tr>
  `).join("");
  const extra = data.activeKasir.length ? `
    <h2 style="font-size:12px;margin:20px 0 8px">Kasir aktif hari ini</h2>
    <table><thead><tr><th>Kasir</th><th>Masuk</th><th class="num">Order</th><th class="num">Omzet</th></tr></thead><tbody>${kasirRows}</tbody></table>
  ` : "";
  return base.replace("</body>", `${extra}<div class="footer">Rekap tutup hari · ${formatWibNow()} WIB</div></body>`);
}

export function buildDayCloseWhatsAppText(data: DayCloseData): string {
  const lines = [
    `📊 *Rekap Tutup Hari*`,
    data.businessName,
    `Tanggal: ${data.tanggal}`,
    ``,
    `Order: ${data.kpis.totalOrders}`,
    `Omzet: Rp${data.kpis.omzet.toLocaleString("id-ID")}`,
    `Laba: Rp${Math.round(data.kpis.laba).toLocaleString("id-ID")}`,
    `Tunai: Rp${data.kpis.tunai.toLocaleString("id-ID")} · QRIS: Rp${data.kpis.qris.toLocaleString("id-ID")}`,
  ];
  if (data.activeKasir.length) {
    lines.push("", "*Kasir shift hari ini:*");
    data.activeKasir.forEach(k => {
      lines.push(`• ${k.nama} — ${k.orderCount} order · Rp${k.omzet.toLocaleString("id-ID")}`);
    });
  }
  lines.push("", "_Via Gercep AI_");
  return lines.join("\n");
}

export function exportDayCloseExcel(data: DayCloseData) {
  exportKasirExcel(data.orders, data.kpis, {
    businessName: data.businessName,
    periodLabel: `Tutup hari ${data.tanggal}`,
  });
}
