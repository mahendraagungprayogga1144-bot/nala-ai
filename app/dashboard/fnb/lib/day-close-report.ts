import type { DayCloseData } from "./day-close-types";
import { exportKasirPdfHtml, exportKasirExcel } from "@/app/dashboard/keuangan-bisnis/lib/kasir-export";
import { escapeHtml, fmtRpFull, formatWibNow } from "@/app/dashboard/inventory/lib/export-helpers";

export type { DayCloseData } from "./day-close-types";
export { buildDayCloseWhatsAppText } from "./day-close-types";

export function buildDayClosePdfHtml(data: DayCloseData): string {
  const ctx = { businessName: data.businessName, periodLabel: `Tutup hari · ${data.tanggal}` };
  const base = exportKasirPdfHtml(data.orders, data.kpis, ctx);
  const kasirRows = data.activeKasir
    .map(
      (k) => `
    <tr><td>${escapeHtml(k.nama)}</td><td>${escapeHtml(k.jamMasuk)}</td><td class="num">${k.orderCount}</td><td class="num">${fmtRpFull(k.omzet)}</td></tr>
  `,
    )
    .join("");
  const extra = data.activeKasir.length
    ? `
    <h2 style="font-size:12px;margin:20px 0 8px">Kasir aktif hari ini</h2>
    <table><thead><tr><th>Kasir</th><th>Masuk</th><th class="num">Order</th><th class="num">Omzet</th></tr></thead><tbody>${kasirRows}</tbody></table>
  `
    : "";
  return base.replace(
    "</body>",
    `${extra}<div class="footer">Rekap tutup hari · ${formatWibNow()} WIB</div></body>`,
  );
}

export function exportDayCloseExcel(data: DayCloseData) {
  exportKasirExcel(data.orders, data.kpis, {
    businessName: data.businessName,
    periodLabel: `Tutup hari ${data.tanggal}`,
  });
}
