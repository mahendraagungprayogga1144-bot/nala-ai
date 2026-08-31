import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { pdfSafe } from "./nota";
import { fmtDateId } from "./money";
import { servedByLabel, type SalesReport } from "./report-service";
import { embedBrandFonts } from "./pdf-fonts";

const INK = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.42, 0.42, 0.42);
const LINE = rgb(0.78, 0.78, 0.8);
const TEAL = rgb(0.12, 0.52, 0.48);
const CASH_C = rgb(0.18, 0.45, 0.38);
const TF_C = rgb(0.2, 0.35, 0.55);
const PAGE_W = 842;
const PAGE_H = 595;
const LEFT = 28;
const RIGHT = PAGE_W - 28;

function rp(n: number) {
  const abs = Math.abs(Math.round(Number(n) || 0));
  const s = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}Rp${s}`;
}

function T(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = INK,
) {
  const t = pdfSafe(String(text || "")).slice(0, 80);
  if (!t) return;
  page.drawText(t, { x, y, size, font, color });
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
  let t = pdfSafe(String(text || "")).slice(0, 80);
  if (!t) return;
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -1);
  if (t !== pdfSafe(String(text || "")).slice(0, 80) && t.length > 2) t = `${t.slice(0, -1)}.`;
  page.drawText(t, { x, y, size, font, color });
}

function rightText(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: PDFFont,
  color = INK,
) {
  const t = pdfSafe(String(text || "")).slice(0, 40);
  page.drawText(t, { x: rightX - font.widthOfTextAtSize(t, size), y, size, font, color });
}

export async function buildSalesReportPdf(opts: {
  businessName: string;
  generatedAt: string;
  report: SalesReport;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { sans, sansBold, serif } = await embedBrandFonts(doc);
  const r = opts.report;
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 36;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - 36;
  };
  const need = (h: number) => {
    if (y < h) newPage();
  };

  T(page, "HENIMA", LEFT, y, 18, serif);
  T(page, "REKAP RETAIL CASH / CASHLESS", LEFT + 92, y + 2, 11, sansBold, MUTED);
  rightText(page, pdfSafe(opts.businessName), RIGHT, y + 4, 10, sans, MUTED);
  y -= 16;
  T(page, `Periode ${pdfSafe(r.range.label)}`, LEFT, y, 10, sansBold);
  T(page, `${r.range.from}  -  ${r.range.to}   |   Dibuat ${pdfSafe(opts.generatedAt)} WIB`, LEFT + 200, y, 9, sans, MUTED);
  y -= 10;
  page.drawRectangle({ x: LEFT, y, width: RIGHT - LEFT, height: 0.6, color: INK });
  y -= 18;

  const kpis: [string, string][] = [
    ["TRANSAKSI", String(r.totalOrders)],
    ["QTY", `${r.totalQty} pcs`],
    ["OMZET", rp(r.totalRevenue)],
    ["CASH", rp(r.cashTotal || 0)],
    ["TRANSFER", rp(r.transferTotal || 0)],
    ["QRIS", rp(r.qrisTotal || 0)],
    ["HPP", rp(r.hppTotal || 0)],
    ["PROFIT", rp(r.profitTotal || 0)],
  ];
  const boxW = (RIGHT - LEFT - 18) / 8;
  kpis.forEach((kpi, i) => {
    const x = LEFT + i * (boxW + 2.5);
    page.drawRectangle({ x, y: y - 32, width: boxW, height: 38, borderColor: LINE, borderWidth: 0.5 });
    T(page, kpi[0], x + 6, y - 6, 6.5, sansBold, MUTED);
    T(page, kpi[1], x + 6, y - 22, 9, sansBold);
  });
  y -= 52;

  const days = Object.entries(r.byDayOmzet || {}).sort((a, b) => a[0].localeCompare(b[0]));
  need(110);
  T(page, "GRAFIK OMZET HARIAN  (hijau = cash, biru = cashless)", LEFT, y, 9, sansBold);
  y -= 8;
  if (!days.length) {
    T(page, "Belum ada penjualan pada periode ini.", LEFT, y, 9, sans, MUTED);
    y -= 16;
  } else {
    const max = Math.max(...days.map((d) => d[1].omzet), 1);
    const chartH = 72;
    const chartW = RIGHT - LEFT;
    const gap = 2;
    const barW = Math.max(4, Math.min(18, (chartW - gap * days.length) / days.length));
    page.drawRectangle({ x: LEFT, y: y - chartH, width: chartW, height: chartH, borderColor: LINE, borderWidth: 0.4 });
    days.forEach((d, i) => {
      const x = LEFT + i * (barW + gap);
      const cashH = (d[1].cash / max) * (chartH - 4);
      const tfH = (d[1].cashless / max) * (chartH - 4);
      page.drawRectangle({ x, y: y - chartH + 2, width: barW, height: Math.max(1, cashH), color: CASH_C });
      page.drawRectangle({
        x,
        y: y - chartH + 2 + Math.max(1, cashH),
        width: barW,
        height: Math.max(0, tfH),
        color: TF_C,
      });
    });
    y -= chartH + 14;
    T(page, `${days[0][0]}  →  ${days[days.length - 1][0]}`, LEFT, y, 8, sans, MUTED);
    y -= 16;
  }

  need(48);
  T(page, "PEMBAYARAN", LEFT, y, 9, sansBold);
  y -= 12;
  const payRows: [string, number, typeof CASH_C][] = [
    ["CASH", r.byPay.CASH || 0, CASH_C],
    ["TRANSFER / TF", r.byPay.TRANSFER || 0, TF_C],
    ["QRIS", r.byPay.QRIS || 0, TEAL],
    ["LAINNYA", r.byPay.OTHER || 0, MUTED],
  ];
  const payMax = Math.max(...payRows.map((p) => p[1]), 1);
  for (const [label, amount, color] of payRows) {
    T(page, label, LEFT, y, 8, sans);
    page.drawRectangle({ x: LEFT + 90, y: y - 1, width: 220, height: 8, color: rgb(0.93, 0.93, 0.94) });
    page.drawRectangle({ x: LEFT + 90, y: y - 1, width: Math.max(2, (amount / payMax) * 220), height: 8, color });
    T(page, rp(amount), LEFT + 320, y, 8, sansBold);
    y -= 12;
  }
  y -= 8;

  need(80);
  T(page, "NAMA", LEFT, y, 7.5, sansBold, MUTED);
  T(page, "TANGGAL", LEFT + 92, y, 7.5, sansBold, MUTED);
  T(page, "KETERANGAN", LEFT + 152, y, 7.5, sansBold, MUTED);
  T(page, "QTY", LEFT + 318, y, 7.5, sansBold, MUTED);
  rightText(page, "CASH", LEFT + 430, y, 7.5, sansBold, MUTED);
  rightText(page, "TF", LEFT + 510, y, 7.5, sansBold, MUTED);
  rightText(page, "QRIS", LEFT + 590, y, 7.5, sansBold, MUTED);
  rightText(page, "HPP", LEFT + 680, y, 7.5, sansBold, MUTED);
  rightText(page, "PROFIT", RIGHT, y, 7.5, sansBold, MUTED);
  y -= 5;
  page.drawRectangle({ x: LEFT, y, width: RIGHT - LEFT, height: 0.6, color: INK });
  y -= 12;

  const rows = r.lines || [];
  if (!rows.length) {
    T(page, "Belum ada baris transaksi.", LEFT, y, 9, sans, MUTED);
    y -= 14;
  }
  for (const line of rows) {
    need(22);
    clip(page, line.customerName, LEFT, y, 8, sans, 88);
    T(page, fmtDateId(line.date).replace(/[^\x20-\x7e]/g, "/"), LEFT + 92, y, 8, sans);
    clip(page, line.note, LEFT + 152, y, 8, sans, 160);
    T(page, String(line.qty), LEFT + 322, y, 8, sans);
    rightText(page, line.cash ? rp(line.cash) : "-", LEFT + 430, y, 8, sans);
    rightText(page, line.transfer ? rp(line.transfer) : "-", LEFT + 510, y, 8, sans);
    rightText(page, line.qris ? rp(line.qris) : "-", LEFT + 590, y, 8, sans);
    rightText(page, rp(line.hpp), LEFT + 680, y, 8, sans);
    rightText(page, rp(line.profit), RIGHT, y, 8, sansBold);
    y -= 11;
    page.drawRectangle({ x: LEFT, y: y + 7, width: RIGHT - LEFT, height: 0.3, color: LINE });
    y -= 2;
  }

  y -= 8;
  need(40);
  page.drawRectangle({ x: LEFT, y: y + 4, width: RIGHT - LEFT, height: 0.7, color: INK });
  y -= 8;
  T(page, "TOTAL", LEFT, y, 9, sansBold);
  T(page, String(r.totalQty), LEFT + 322, y, 9, sansBold);
  rightText(page, rp(r.cashTotal || 0), LEFT + 430, y, 9, sansBold);
  rightText(page, rp(r.transferTotal || 0), LEFT + 510, y, 9, sansBold);
  rightText(page, rp(r.qrisTotal || 0), LEFT + 590, y, 9, sansBold);
  rightText(page, rp(r.hppTotal || 0), LEFT + 680, y, 9, sansBold);
  rightText(page, rp(r.profitTotal || 0), RIGHT, y, 9, sansBold);
  y -= 22;

  need(70);
  T(page, "PRODUK", LEFT, y, 9, sansBold);
  T(page, "RANKING SALES", LEFT + 320, y, 9, sansBold);
  y -= 14;
  const prod = r.byProduct.slice(0, 8);
  const rank = r.ranking.slice(0, 8);
  const n = Math.max(prod.length, rank.length, 1);
  for (let i = 0; i < n; i++) {
    need(16);
    if (prod[i]) T(page, `${prod[i].name}   ${prod[i].qty} pcs   ${rp(prod[i].omzet)}`, LEFT, y, 8, sans);
    if (rank[i]) T(page, `${i + 1}. ${rank[i].nama}   ${rank[i].qty} pcs   ${rp(rank[i].revenue)}`, LEFT + 320, y, 8, sans);
    y -= 12;
  }
  if (r.servedBy.length) {
    y -= 4;
    T(page, servedByLabel(r.servedBy), LEFT, y, 8, sans, MUTED);
    y -= 12;
  }

  T(page, "Henima Collection  |  Rekap internal, bukan nota customer.", LEFT, 18, 7.5, sans, MUTED);
  return doc.save();
}

export function reportToCsv(report: SalesReport) {
  const lines = [
    "metric,value",
    `periode,${report.range.label}`,
    `transaksi,${report.totalOrders}`,
    `pcs,${report.totalQty}`,
    `omzet,${report.totalRevenue}`,
    `cash,${report.cashTotal || 0}`,
    `transfer,${report.transferTotal || 0}`,
    `qris,${report.qrisTotal || 0}`,
    `cashless,${report.cashlessTotal || 0}`,
    `hpp,${report.hppTotal || 0}`,
    `profit,${report.profitTotal || 0}`,
    `customer_baru,${report.newCustomers}`,
    `repeat,${report.repeatCustomers}`,
    `komisi,${report.totalCommission}`,
    "",
    "nama,tanggal,keterangan,qty,cash,transfer,qris,metode,hpp,profit,sales",
    ...(report.lines || []).map(
      (l) =>
        `${l.customerName},${l.date},${l.note},${l.qty},${l.cash},${l.transfer},${l.qris},${l.method},${l.hpp},${l.profit},${l.salesName}`,
    ),
    "",
    "ranking,nama,pcs,omzet,trx",
    ...report.ranking.map((s, i) => `${i + 1},${s.nama},${s.qty},${s.revenue},${s.count}`),
    "",
    "produk,pcs,omzet",
    ...report.byProduct.map((p) => `${p.name},${p.qty},${p.omzet}`),
  ];
  return lines.join("\n");
}
