import type { ExportContext, ExportProductRow, InventoryKpis } from "./export-types";
import { escapeHtml, fmtRpFull, formatWibNow } from "./export-helpers";

const A4_STYLES = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #111; margin: 0; padding: 24px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2DD4BF; padding-bottom: 12px; margin-bottom: 16px; }
  .brand { font-size: 11px; color: #666; margin-top: 4px; }
  .biz-name { font-size: 18px; font-weight: 700; color: #111; }
  .meta { text-align: right; font-size: 11px; color: #555; }
  h1 { text-align: center; font-size: 16px; letter-spacing: 0.08em; margin: 16px 0 4px; }
  .subtitle { text-align: center; font-size: 11px; color: #666; margin-bottom: 16px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; text-align: center; }
  .kpi-label { font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: 0.05em; }
  .kpi-value { font-size: 16px; font-weight: 700; margin-top: 4px; font-family: monospace; }
  .kpi-value.warn { color: #d97706; }
  .kpi-value.danger { color: #dc2626; }
  .kpi-value.ok { color: #0d9488; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; font-size: 10px; }
  th { background: #f3f4f6; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.04em; }
  td.num, th.num { text-align: right; font-family: monospace; }
  .status-aman { color: #059669; font-weight: 600; }
  .status-menipis { color: #d97706; font-weight: 600; }
  .status-habis { color: #dc2626; font-weight: 600; }
  .total-row td { font-weight: 700; background: #f9fafb; }
  .section-title { font-size: 12px; font-weight: 700; margin: 20px 0 8px; color: #374151; }
  .footer { margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; color: #888; }
  .sign { text-align: center; min-width: 180px; }
  .sign-line { border-top: 1px solid #999; margin-top: 48px; padding-top: 6px; }
  .gercep { font-size: 9px; color: #8B5CF6; }
`;

function statusClass(status: string): string {
  if (status === "habis") return "status-habis";
  if (status === "menipis") return "status-menipis";
  return "status-aman";
}

function reportHeader(ctx: ExportContext, title: string): string {
  return `
    <div class="header">
      <div>
        <div class="biz-name">${escapeHtml(ctx.businessName)}</div>
        <div class="brand">Rekapan Stok · Gercep AI</div>
      </div>
      <div class="meta">
        Dicetak: ${formatWibNow()} WIB<br/>
        ${ctx.filterLabel ? `Filter: ${escapeHtml(ctx.filterLabel)}` : ""}
      </div>
    </div>
    <h1>${escapeHtml(title)}</h1>
    <p class="subtitle">${formatWibNow()} WIB</p>
  `;
}

function kpiGrid(kpis: InventoryKpis): string {
  return `
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Total Item</div><div class="kpi-value">${kpis.totalItem}</div></div>
      <div class="kpi"><div class="kpi-label">Stok Tersedia</div><div class="kpi-value ok">${kpis.stokTersedia.toLocaleString("id-ID")}</div></div>
      <div class="kpi"><div class="kpi-label">Stok Menipis</div><div class="kpi-value warn">${kpis.stokMenipis}</div></div>
      <div class="kpi"><div class="kpi-label">Stok Habis</div><div class="kpi-value danger">${kpis.stokHabis}</div></div>
    </div>
    <div class="kpi" style="max-width:280px;margin:0 auto 20px">
      <div class="kpi-label">Total Nilai Stok</div>
      <div class="kpi-value ok" style="font-size:20px">${fmtRpFull(kpis.totalNilaiStok)}</div>
    </div>
  `;
}

function detailTable(rows: ExportProductRow[], showTotal = true): string {
  const body = rows.map(r => `
    <tr>
      <td class="num">${r.no}</td>
      <td>${escapeHtml(r.kode)}</td>
      <td>${escapeHtml(r.nama)}</td>
      <td>${escapeHtml(r.kategori)}</td>
      <td>${escapeHtml(r.satuan)}</td>
      <td class="num">${r.stok}</td>
      <td class="num">${r.minStok}</td>
      <td class="num">${fmtRpFull(r.hargaBeli)}</td>
      <td class="num">${fmtRpFull(r.nilaiStok)}</td>
      <td class="${statusClass(r.status)}">${r.statusLabel}</td>
    </tr>
  `).join("");

  const total = rows.reduce((s, r) => s + r.nilaiStok, 0);
  const totalRow = showTotal ? `
    <tr class="total-row">
      <td colspan="8" style="text-align:right">TOTAL NILAI STOK</td>
      <td class="num">${fmtRpFull(total)}</td>
      <td></td>
    </tr>
  ` : "";

  return `
    <table>
      <thead>
        <tr>
          <th class="num">No</th>
          <th>Kode</th>
          <th>Nama</th>
          <th>Kategori</th>
          <th>Satuan</th>
          <th class="num">Stok</th>
          <th class="num">Min</th>
          <th class="num">Harga Beli</th>
          <th class="num">Nilai</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${body}${totalRow}</tbody>
    </table>
  `;
}

function reportFooter(ctx: ExportContext): string {
  return `
    <div class="footer">
      <div class="gercep">Dicetak via Gercep AI · gercep.id</div>
      <div class="sign">
        <div class="sign-line">Mengetahui,<br/><strong>${escapeHtml(ctx.businessName)}</strong></div>
      </div>
    </div>
  `;
}

export function buildPdfRingkasHtml(
  rows: ExportProductRow[],
  kpis: InventoryKpis,
  ctx: ExportContext,
  topN = 10,
): string {
  const critical = rows
    .filter(r => r.status !== "aman")
    .sort((a, b) => a.stok - b.stok)
    .slice(0, topN);

  const topTable = critical.length > 0
    ? `<p class="section-title">TOP ${topN} BAHAN STOK KRITIS</p>${detailTable(critical.map((r, i) => ({ ...r, no: i + 1 })), false)}`
    : `<p class="section-title">Semua bahan dalam kondisi aman ✓</p>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Rekapan Stok Ringkas</title><style>${A4_STYLES}</style></head><body>
    ${reportHeader(ctx, "REKAPAN INVENTORY — RINGKASAN")}
    ${kpiGrid(kpis)}
    ${topTable}
    ${reportFooter(ctx)}
  </body></html>`;
}

export function buildPdfDetailHtml(
  rows: ExportProductRow[],
  kpis: InventoryKpis,
  ctx: ExportContext,
): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Rekapan Stok Detail</title><style>${A4_STYLES}</style></head><body>
    ${reportHeader(ctx, "REKAPAN INVENTORY — DETAIL")}
    ${kpiGrid(kpis)}
    <p class="section-title">DAFTAR LENGKAP STOK</p>
    ${detailTable(rows)}
    ${reportFooter(ctx)}
  </body></html>`;
}

export function exportInventoryPdfRingkas(
  rows: ExportProductRow[],
  kpis: InventoryKpis,
  ctx: ExportContext,
): string | null {
  if (rows.length === 0) return null;
  return buildPdfRingkasHtml(rows, kpis, ctx);
}

export function exportInventoryPdfDetail(
  rows: ExportProductRow[],
  kpis: InventoryKpis,
  ctx: ExportContext,
): string | null {
  if (rows.length === 0) return null;
  return buildPdfDetailHtml(rows, kpis, ctx);
}
