import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { pdfSafe } from "@/lib/henima-sales/pdf-text";
import { fmtRpFull } from "@/app/dashboard/inventory/lib/export-helpers";
import type { MonthlyReportData } from "./monthly-report";

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const INK = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.4, 0.4, 0.42);
const LINE = rgb(0.82, 0.82, 0.84);
const TEAL = rgb(0.1, 0.55, 0.5);

function money(n: number) {
  return pdfSafe(fmtRpFull(n));
}

function draw(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = INK,
) {
  const t = pdfSafe(text).slice(0, 120);
  if (!t) return;
  page.drawText(t, { x, y, size, font, color });
}

function drawRight(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: PDFFont,
  color = INK,
) {
  const t = pdfSafe(text).slice(0, 40);
  if (!t) return;
  page.drawText(t, { x: rightX - font.widthOfTextAtSize(t, size), y, size, font, color });
}

function clip(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  maxW: number,
  color = INK,
) {
  let t = pdfSafe(text).slice(0, 80);
  if (!t) return;
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -1);
  page.drawText(t, { x, y, size, font, color });
}

/** Buat file PDF rekap bulanan owner lalu unduh di browser. */
export async function downloadMonthlyReportPdf(data: MonthlyReportData) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensure = (need: number) => {
    if (y - need > MARGIN) return;
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  draw(page, data.filterLabel || "Owner Dashboard", MARGIN, y, 16, bold, TEAL);
  y -= 18;
  draw(page, `Rekap bulanan · ${data.periodLabel}`, MARGIN, y, 11, font, MUTED);
  y -= 14;
  draw(page, `Owner: ${data.ownerName}`, MARGIN, y, 10, font, MUTED);
  y -= 10;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1.2,
    color: TEAL,
  });
  y -= 22;

  draw(page, "RINGKASAN", MARGIN, y, 11, bold);
  y -= 16;
  const kpis = [
    ["Omzet", money(data.totalOmzet)],
    ["Laba", money(data.totalLaba)],
    ["Rugi", money(data.totalRugi)],
    ["Order", String(data.totalOrder)],
  ];
  const colW = (PAGE_W - MARGIN * 2) / 4;
  kpis.forEach(([label, value], i) => {
    const x = MARGIN + i * colW;
    page.drawRectangle({
      x,
      y: y - 28,
      width: colW - 8,
      height: 40,
      borderColor: LINE,
      borderWidth: 0.8,
    });
    draw(page, label, x + 8, y, 8, font, MUTED);
    draw(page, value, x + 8, y - 16, 10, bold);
  });
  y -= 56;

  ensure(40);
  draw(page, "PERFORMA PER BISNIS", MARGIN, y, 11, bold);
  y -= 14;
  const headers = ["Bisnis", "Omzet", "Laba", "Order", "Margin", "Growth"];
  const widths = [150, 75, 75, 45, 50, 55];
  let x = MARGIN;
  headers.forEach((h, i) => {
    draw(page, h, x, y, 8, bold, MUTED);
    x += widths[i];
  });
  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.6,
    color: LINE,
  });
  y -= 14;

  for (const b of data.businesses) {
    ensure(18);
    x = MARGIN;
    clip(page, b.name, x, y, 9, font, widths[0] - 4);
    x += widths[0];
    drawRight(page, money(b.omzet), x + widths[1] - 4, y, 8, font);
    x += widths[1];
    drawRight(page, money(b.laba), x + widths[2] - 4, y, 8, font);
    x += widths[2];
    drawRight(page, String(b.orderCount), x + widths[3] - 4, y, 8, font);
    x += widths[3];
    drawRight(page, `${b.margin}%`, x + widths[4] - 4, y, 8, font);
    x += widths[4];
    drawRight(page, `${b.growthPct >= 0 ? "+" : ""}${b.growthPct}%`, x + widths[5] - 4, y, 8, font);
    y -= 14;
  }

  if (data.expenses.length) {
    ensure(40);
    y -= 8;
    draw(page, "BEBAN PER KATEGORI", MARGIN, y, 11, bold);
    y -= 14;
    for (const e of data.expenses.slice(0, 12)) {
      ensure(14);
      clip(page, e.name, MARGIN, y, 9, font, 280);
      drawRight(page, money(e.amount), PAGE_W - MARGIN, y, 9, font);
      y -= 13;
    }
  }

  if (data.topProducts.length) {
    ensure(40);
    y -= 8;
    draw(page, "TOP PRODUK", MARGIN, y, 11, bold);
    y -= 14;
    data.topProducts.slice(0, 8).forEach((p, i) => {
      ensure(14);
      draw(page, `${i + 1}.`, MARGIN, y, 9, font, MUTED);
      clip(page, p.name, MARGIN + 18, y, 9, font, 250);
      drawRight(page, `${p.sold} pcs`, PAGE_W - MARGIN - 100, y, 8, font, MUTED);
      drawRight(page, money(p.revenue), PAGE_W - MARGIN, y, 9, font);
      y -= 13;
    });
  }

  const critical = data.businesses.filter((b) => b.stokKritis.length > 0);
  ensure(36);
  y -= 10;
  draw(page, "STOK KRITIS", MARGIN, y, 11, bold);
  y -= 14;
  if (!critical.length) {
    draw(page, "Tidak ada stok kritis pada periode ini.", MARGIN, y, 9, font, MUTED);
  } else {
    for (const b of critical) {
      ensure(14);
      clip(page, `${b.name}: ${b.stokKritis.join(", ")}`, MARGIN, y, 9, font, PAGE_W - MARGIN * 2);
      y -= 13;
    }
  }

  y = Math.min(y, MARGIN + 24);
  draw(page, "Generated by Gercep AI · Dashboard Owner", MARGIN, MARGIN, 8, font, MUTED);

  const bytes = await doc.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safePeriod = pdfSafe(data.periodLabel).replace(/\s+/g, "-") || "bulanan";
  a.href = url;
  a.download = `rekap-owner-${safePeriod}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
