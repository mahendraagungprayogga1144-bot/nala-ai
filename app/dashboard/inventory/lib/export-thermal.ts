import type { ExportContext, ExportProductRow, InventoryKpis } from "./export-types";
import { escapeHtml, fmtRpFull, fmtRpShort, formatWibNow } from "./export-helpers";

function thermalStyles(widthMm: number): string {
  return `
    @page { size: ${widthMm}mm auto; margin: 3mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${widthMm <= 58 ? "9px" : "10px"};
      line-height: 1.35;
      color: #000;
      width: ${widthMm}mm;
      padding: 4mm 3mm;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .line { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; gap: 4px; }
    .title { font-size: ${widthMm <= 58 ? "11px" : "12px"}; font-weight: 700; letter-spacing: 0.05em; }
    .item { margin: 3px 0; font-size: ${widthMm <= 58 ? "8px" : "9px"}; }
    .footer { margin-top: 8px; font-size: 8px; text-align: center; }
  `;
}

export function buildThermalHtml(
  rows: ExportProductRow[],
  kpis: InventoryKpis,
  ctx: ExportContext,
  widthMm: number,
): string {
  const critical = rows
    .filter(r => r.status !== "aman")
    .sort((a, b) => a.stok - b.stok)
    .slice(0, 8);

  const criticalLines = critical.length > 0
    ? critical.map(r => `
        <div class="item">
          <div class="bold">${escapeHtml(r.nama)}</div>
          <div class="row">
            <span>${r.stok}/${r.minStok} ${escapeHtml(r.satuan)}</span>
            <span>${r.statusLabel}</span>
          </div>
        </div>
      `).join("")
    : `<div class="item center">Semua bahan aman</div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ringkasan Stok</title>
    <style>${thermalStyles(widthMm)}</style></head><body>
    <div class="center title">${escapeHtml(ctx.businessName.toUpperCase())}</div>
    <div class="center bold" style="margin-top:4px">RINGKASAN STOK</div>
    <div class="line"></div>
    <div class="row"><span>Total Item</span><span class="bold">${kpis.totalItem}</span></div>
    <div class="row"><span>Stok Tersedia</span><span>${kpis.stokTersedia}</span></div>
    <div class="row"><span>Stok Menipis</span><span>${kpis.stokMenipis}</span></div>
    <div class="row"><span>Stok Habis</span><span>${kpis.stokHabis}</span></div>
    <div class="row"><span>Nilai Stok</span><span class="bold">${fmtRpShort(kpis.totalNilaiStok)}</span></div>
    ${ctx.filterLabel ? `<div class="row" style="margin-top:4px"><span>Filter</span><span>${escapeHtml(ctx.filterLabel)}</span></div>` : ""}
    <div class="line"></div>
    <div class="bold" style="margin-bottom:4px">KRITIS / MENIPIS:</div>
    ${criticalLines}
    <div class="line"></div>
    <div class="footer">
      Dicetak: ${formatWibNow()} WIB<br/>
      Gercep AI
    </div>
  </body></html>`;
}

export function exportInventoryThermal(
  rows: ExportProductRow[],
  kpis: InventoryKpis,
  ctx: ExportContext,
  widthMm: number,
): string | null {
  if (rows.length === 0) return null;
  const w = Math.min(Math.max(widthMm, 48), 120);
  return buildThermalHtml(rows, kpis, ctx, w);
}
