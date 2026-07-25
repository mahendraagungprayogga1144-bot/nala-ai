import { escapeHtml, fmtRpFull, formatWibNow } from "@/app/dashboard/inventory/lib/export-helpers";

export type MonthlyReportBiz = {
  name: string;
  type: string;
  omzet: number;
  laba: number;
  orderCount: number;
  margin: number;
  growthPct: number;
  targetOmzet: number;
  stokKritis: string[];
};

export type MonthlyReportData = {
  ownerName: string;
  periodLabel: string;
  filterLabel: string;
  totalOmzet: number;
  totalLaba: number;
  totalRugi: number;
  totalOrder: number;
  avgOrder: number;
  businesses: MonthlyReportBiz[];
  expenses: { name: string; amount: number }[];
  topProducts: { name: string; sold: number; revenue: number }[];
};

const PDF_STYLES = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #111; margin: 0; padding: 22px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2DD4BF; padding-bottom: 12px; margin-bottom: 14px; }
  .biz-name { font-size: 18px; font-weight: 700; }
  .brand { font-size: 11px; color: #666; margin-top: 3px; }
  .meta { text-align: right; font-size: 11px; color: #555; line-height: 1.45; }
  h1 { text-align: center; font-size: 15px; letter-spacing: 0.08em; margin: 8px 0 2px; }
  .subtitle { text-align: center; font-size: 11px; color: #666; margin-bottom: 14px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 8px; text-align: center; }
  .kpi-label { font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: 0.04em; }
  .kpi-value { font-size: 13px; font-weight: 700; margin-top: 4px; font-family: ui-monospace, monospace; }
  h2 { font-size: 12px; margin: 18px 0 8px; border-left: 3px solid #2DD4BF; padding-left: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 10px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; text-transform: uppercase; font-size: 9px; }
  td.num, th.num { text-align: right; font-family: ui-monospace, monospace; }
  .pos { color: #059669; }
  .neg { color: #e11d48; }
  .total-row td { font-weight: 700; background: #f9fafb; }
  .footer { margin-top: 24px; font-size: 10px; color: #888; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  .note { font-size: 10px; color: #666; margin-top: 6px; }
`;

export function buildMonthlyReportPdfHtml(data: MonthlyReportData): string {
  const bizRows = data.businesses
    .map(
      (b) => `
    <tr>
      <td>${escapeHtml(b.name)}<br/><span style="color:#666;font-size:9px">${escapeHtml(b.type)}</span></td>
      <td class="num">${fmtRpFull(b.omzet)}</td>
      <td class="num ${b.laba >= 0 ? "pos" : "neg"}">${fmtRpFull(b.laba)}</td>
      <td class="num">${b.orderCount}</td>
      <td class="num">${b.margin}%</td>
      <td class="num ${b.growthPct >= 0 ? "pos" : "neg"}">${b.growthPct >= 0 ? "+" : ""}${b.growthPct}%</td>
    </tr>`,
    )
    .join("");

  const expenseRows = data.expenses
    .slice(0, 10)
    .map(
      (e) => `
    <tr><td>${escapeHtml(e.name)}</td><td class="num">${fmtRpFull(e.amount)}</td></tr>`,
    )
    .join("");

  const productRows = data.topProducts
    .slice(0, 8)
    .map(
      (p, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${escapeHtml(p.name)}</td>
      <td class="num">${p.sold}</td>
      <td class="num">${fmtRpFull(p.revenue)}</td>
    </tr>`,
    )
    .join("");

  const stockNotes = data.businesses
    .filter((b) => b.stokKritis.length > 0)
    .map((b) => `${escapeHtml(b.name)}: ${b.stokKritis.map(escapeHtml).join(", ")}`)
    .join(" · ");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Rekap ${escapeHtml(data.periodLabel)}</title><style>${PDF_STYLES}</style></head><body>
  <div class="header">
    <div>
      <div class="biz-name">${escapeHtml(data.filterLabel)}</div>
      <div class="brand">Rekap Bulanan Owner · Gercep AI</div>
    </div>
    <div class="meta">
      Owner: ${escapeHtml(data.ownerName)}<br/>
      Periode: ${escapeHtml(data.periodLabel)}<br/>
      Dicetak: ${formatWibNow()} WIB
    </div>
  </div>
  <h1>REKAP KINERJA BULANAN</h1>
  <p class="subtitle">${escapeHtml(data.periodLabel)} · ${escapeHtml(data.filterLabel)}</p>

  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Total Omzet</div><div class="kpi-value" style="color:#0d9488">${fmtRpFull(data.totalOmzet)}</div></div>
    <div class="kpi"><div class="kpi-label">Total Laba</div><div class="kpi-value" style="color:#059669">${fmtRpFull(data.totalLaba)}</div></div>
    <div class="kpi"><div class="kpi-label">Total Rugi</div><div class="kpi-value" style="color:#e11d48">${fmtRpFull(data.totalRugi)}</div></div>
    <div class="kpi"><div class="kpi-label">Total Order</div><div class="kpi-value">${data.totalOrder}<div style="font-size:9px;font-weight:500;color:#666;margin-top:2px">avg ${fmtRpFull(data.avgOrder)}</div></div></div>
  </div>

  <h2>Performa per Bisnis</h2>
  <table>
    <thead><tr>
      <th>Bisnis</th><th class="num">Omzet</th><th class="num">Laba/Rugi</th>
      <th class="num">Order</th><th class="num">Margin</th><th class="num">Growth</th>
    </tr></thead>
    <tbody>
      ${bizRows || `<tr><td colspan="6" style="text-align:center;color:#666">Belum ada data</td></tr>`}
      <tr class="total-row">
        <td>TOTAL</td>
        <td class="num">${fmtRpFull(data.totalOmzet)}</td>
        <td class="num">${fmtRpFull(data.totalLaba - data.totalRugi)}</td>
        <td class="num">${data.totalOrder}</td>
        <td class="num" colspan="2"></td>
      </tr>
    </tbody>
  </table>

  ${
    expenseRows
      ? `<h2>Beban per Kategori</h2>
  <table><thead><tr><th>Kategori</th><th class="num">Nominal</th></tr></thead><tbody>${expenseRows}</tbody></table>`
      : ""
  }

  ${
    productRows
      ? `<h2>Top Produk / Menu</h2>
  <table><thead><tr><th class="num">No</th><th>Nama</th><th class="num">Terjual</th><th class="num">Revenue</th></tr></thead><tbody>${productRows}</tbody></table>`
      : ""
  }

  ${
    stockNotes
      ? `<h2>Stok Kritis</h2><p class="note">${stockNotes}</p>`
      : `<h2>Stok Kritis</h2><p class="note">Tidak ada stok kritis pada periode ini.</p>`
  }

  <div class="footer">
    Generated by Gercep AI · Rekap bulanan owner<br/>
    Simpan sebagai PDF lewat dialog Print → Save as PDF
  </div>
</body></html>`;
}

export function buildMonthlyWhatsAppText(data: MonthlyReportData): string {
  const lines = [
    `*Rekap Bulanan · ${data.periodLabel}*`,
    data.filterLabel,
    "",
    `Omzet: ${fmtRpFull(data.totalOmzet)}`,
    `Laba: ${fmtRpFull(data.totalLaba)}`,
    `Rugi: ${fmtRpFull(data.totalRugi)}`,
    `Order: ${data.totalOrder}`,
    "",
    "*Per bisnis:*",
    ...data.businesses.map(
      (b) => `• ${b.name}: omzet ${fmtRpFull(b.omzet)} · laba ${fmtRpFull(b.laba)} (${b.growthPct >= 0 ? "+" : ""}${b.growthPct}%)`,
    ),
    "",
    `_Via Gercep AI_`,
  ];
  return lines.join("\n");
}
