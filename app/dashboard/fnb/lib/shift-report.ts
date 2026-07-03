import { escapeHtml, fmtRpFull, formatWibNow } from "@/app/dashboard/inventory/lib/export-helpers";
import { formatTxTimeWib } from "@/lib/finance/sort-transactions";
import { shortOrderNo } from "./receipt-thermal";

export type ShiftOrderRow = {
  id: string;
  total: number;
  created_at: string;
  itemsSummary: string;
};

export type ShiftReportData = {
  businessName: string;
  kasirName: string;
  tanggal: string;
  jamMasuk: string;
  jamKeluar: string;
  totalOrders: number;
  omzet: number;
  laba: number;
  orders: ShiftOrderRow[];
};

export function buildShiftReportHtml(data: ShiftReportData): string {
  const rows = data.orders.map((o, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${escapeHtml(shortOrderNo(o.id))}</td>
      <td>${escapeHtml(formatTxTimeWib(o.created_at))} WIB</td>
      <td>${escapeHtml(o.itemsSummary)}</td>
      <td class="num">${fmtRpFull(o.total)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    @page { size: A4; margin: 14mm; }
    body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; padding: 20px; }
    h1 { text-align: center; font-size: 16px; margin: 0 0 4px; }
    .sub { text-align: center; color: #666; font-size: 11px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
    .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; }
    .lbl { font-size: 9px; text-transform: uppercase; color: #666; }
    .val { font-weight: 700; font-family: monospace; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 5px 6px; font-size: 10px; }
    th { background: #f3f4f6; }
    td.num, th.num { text-align: right; font-family: monospace; }
    .foot { margin-top: 20px; text-align: center; font-size: 10px; color: #888; }
  </style></head><body>
    <h1>LAPORAN SHIFT KASIR</h1>
    <p class="sub">${escapeHtml(data.businessName)} · ${escapeHtml(data.tanggal)}</p>
    <div class="grid">
      <div class="box"><div class="lbl">Kasir</div><div class="val">${escapeHtml(data.kasirName)}</div></div>
      <div class="box"><div class="lbl">Shift</div><div class="val">${escapeHtml(data.jamMasuk)} – ${escapeHtml(data.jamKeluar)} WIB</div></div>
      <div class="box"><div class="lbl">Total order</div><div class="val">${data.totalOrders}</div></div>
      <div class="box"><div class="lbl">Omzet shift</div><div class="val" style="color:#0d9488">${fmtRpFull(data.omzet)}</div></div>
      <div class="box"><div class="lbl">Laba shift</div><div class="val" style="color:#d97706">${fmtRpFull(Math.round(data.laba))}</div></div>
      <div class="box"><div class="lbl">Dicetak</div><div class="val">${formatWibNow()} WIB</div></div>
    </div>
    <table>
      <thead><tr><th class="num">No</th><th>Nota</th><th>Waktu</th><th>Menu</th><th class="num">Total</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#888">Tidak ada order di shift ini</td></tr>`}</tbody>
    </table>
    <div class="foot">Gercep AI · Laporan shift otomatis</div>
  </body></html>`;
}

export function buildShiftWhatsAppText(data: ShiftReportData): string {
  const lines = [
    `📋 *Laporan Shift Kasir*`,
    `${data.businessName}`,
    `Kasir: ${data.kasirName}`,
    `Tanggal: ${data.tanggal}`,
    `Shift: ${data.jamMasuk} – ${data.jamKeluar} WIB`,
    ``,
    `Order: ${data.totalOrders}`,
    `Omzet: Rp${data.omzet.toLocaleString("id-ID")}`,
    `Laba: Rp${Math.round(data.laba).toLocaleString("id-ID")}`,
  ];
  if (data.orders.length > 0) {
    lines.push("", "*Detail order:*");
    data.orders.slice(0, 8).forEach((o, i) => {
      lines.push(`${i + 1}. ${shortOrderNo(o.id)} · Rp${o.total.toLocaleString("id-ID")} · ${o.itemsSummary.slice(0, 40)}`);
    });
    if (data.orders.length > 8) lines.push(`... +${data.orders.length - 8} order lainnya`);
  }
  lines.push("", "_Via Gercep AI_");
  return lines.join("\n");
}

export function openWhatsAppShare(text: string, phone?: string) {
  const url = phone
    ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
