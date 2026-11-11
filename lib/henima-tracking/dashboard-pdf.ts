import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { pdfSafe } from "@/lib/henima-sales/pdf-text";
import type { OwnerDashboardSummary } from "./owner-dashboard";

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const INK = rgb(0.07, 0.07, 0.07);
const MUTED = rgb(0.42, 0.42, 0.42);
const LINE = rgb(0.9, 0.9, 0.88);
const GOLD = rgb(0.77, 0.64, 0.35);

function money(n: number) {
  return `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
}

function draw(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color = INK) {
  const t = pdfSafe(text).slice(0, 140);
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
  const t = pdfSafe(text).slice(0, 60);
  if (!t) return;
  page.drawText(t, { x: rightX - font.widthOfTextAtSize(t, size), y, size, font, color });
}

/** PDF rekap Command Center — emas HENIMA, siap unduh owner. */
export async function downloadCommandCenterPdf(opts: {
  ownerName: string;
  periodLabel: string;
  summary: OwnerDashboardSummary;
}) {
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

  draw(page, "HENIMA Sales Command Center", MARGIN, y, 16, bold, GOLD);
  y -= 18;
  draw(page, `Rekap performa · ${opts.periodLabel}`, MARGIN, y, 11, font, MUTED);
  y -= 14;
  draw(page, `Owner: ${opts.ownerName}`, MARGIN, y, 10, font, MUTED);
  y -= 12;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1.4,
    color: GOLD,
  });
  y -= 24;

  draw(page, "RINGKASAN", MARGIN, y, 11, bold);
  y -= 18;
  const kpis: [string, string][] = [
    ["Omzet", money(opts.summary.omzetBulan)],
    ["Produk terjual", `${opts.summary.botolBulan} pcs`],
    ["Transaksi", String(opts.summary.transaksiBulan)],
    ["Pencapaian target", `${Math.round(opts.summary.pencapaianPct)}%`],
  ];
  const colW = (PAGE_W - MARGIN * 2) / 4;
  kpis.forEach(([label, value], i) => {
    const x = MARGIN + i * colW;
    draw(page, label, x, y, 8, font, MUTED);
    draw(page, value, x, y - 14, 11, bold);
  });
  y -= 40;

  ensure(40);
  draw(page, "PERINGKAT SALES", MARGIN, y, 11, bold);
  y -= 16;
  if (!opts.summary.ranking.length) {
    draw(page, "Belum ada penjualan lunas pada periode ini.", MARGIN, y, 10, font, MUTED);
    y -= 18;
  } else {
    for (const [i, row] of opts.summary.ranking.slice(0, 10).entries()) {
      ensure(18);
      draw(page, `${i + 1}. ${row.nama}`, MARGIN, y, 10, bold);
      drawRight(page, money(row.omzet), PAGE_W - MARGIN, y, 10, font);
      y -= 12;
      draw(page, `${row.qty} pcs · target ${Math.round(row.pct)}%`, MARGIN + 14, y, 8, font, MUTED);
      y -= 14;
    }
  }

  y -= 8;
  ensure(40);
  draw(page, "TRANSAKSI TERBARU", MARGIN, y, 11, bold);
  y -= 16;
  if (!opts.summary.recentSales.length) {
    draw(page, "Belum ada transaksi.", MARGIN, y, 10, font, MUTED);
    y -= 18;
  } else {
    for (const order of opts.summary.recentSales.slice(0, 12)) {
      ensure(20);
      draw(page, order.customerName, MARGIN, y, 10, bold);
      drawRight(page, money(order.total), PAGE_W - MARGIN, y, 10, font);
      y -= 12;
      draw(
        page,
        `${order.productName} · ${order.salesName} · ${order.status === "PAID" ? "Lunas" : order.status}`,
        MARGIN,
        y,
        8,
        font,
        MUTED,
      );
      y -= 14;
    }
  }

  y -= 10;
  ensure(30);
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.6,
    color: LINE,
  });
  y -= 16;
  draw(page, "Grow Together, Achieve More · HENIMA", MARGIN, y, 9, font, GOLD);
  y -= 12;
  draw(
    page,
    `Dibuat ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`,
    MARGIN,
    y,
    8,
    font,
    MUTED,
  );

  const bytes = await doc.save();
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = opts.periodLabel.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  a.href = url;
  a.download = `henima-command-center-${slug || "rekap"}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
