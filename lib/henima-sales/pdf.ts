import { PDFDocument, RGB, rgb, StandardFonts } from "pdf-lib";
import { fmtDateLongId, fmtRp } from "./money";
import type { SalesReport } from "./report-service";

function colorTeal(): RGB {
  return rgb(0.18, 0.72, 0.66);
}
function colorInk(): RGB {
  return rgb(0.12, 0.12, 0.18);
}
function colorMuted(): RGB {
  return rgb(0.4, 0.4, 0.45);
}

export async function buildSalesReportPdf(opts: {
  businessName: string;
  generatedAt: string;
  report: SalesReport;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 800;

  const draw = (text: string, x: number, yy: number, size = 10, bold = false, c = colorInk()) => {
    page.drawText(text, { x, y: yy, size, font: bold ? fontBold : font, color: c });
  };

  const ensure = (need: number) => {
    if (y < need) {
      page = doc.addPage([595, 842]);
      y = 800;
    }
  };

  page.drawRectangle({ x: 40, y: 810, width: 515, height: 4, color: colorTeal() });
  draw("HENIMA SCENT", 40, y, 16, true, colorTeal());
  draw(opts.businessName, 40, y - 18, 11, false, colorMuted());
  y -= 48;
  draw("LAPORAN PENJUALAN", 40, y, 14, true);
  y -= 16;
  draw(`Periode: ${opts.report.range.label}`, 40, y, 10);
  draw(`Dibuat: ${opts.generatedAt} WIB`, 300, y, 10, false, colorMuted());
  y -= 28;

  const kpis: [string, string][] = [
    ["Total transaksi", String(opts.report.totalOrders)],
    ["Total pcs", String(opts.report.totalQty)],
    ["Omzet", fmtRp(opts.report.totalRevenue)],
    ["AOV", fmtRp(opts.report.aov)],
    ["Customer baru", String(opts.report.newCustomers)],
    ["Repeat customer", String(opts.report.repeatCustomers)],
    ["Komisi", fmtRp(opts.report.totalCommission)],
    ["Testimoni", String(opts.report.testimonialCount)],
  ];
  for (let i = 0; i < kpis.length; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 40 + col * 130;
    const yy = y - row * 48;
    page.drawRectangle({ x, y: yy - 28, width: 120, height: 40, borderColor: rgb(0.85, 0.85, 0.88), borderWidth: 0.6 });
    draw(kpis[i][0], x + 8, yy - 4, 8, false, colorMuted());
    draw(kpis[i][1], x + 8, yy - 20, 11, true);
  }
  y -= 110;

  ensure(120);
  draw("PENJUALAN PER PRODUK", 40, y, 11, true);
  y -= 16;
  for (const p of opts.report.byProduct) {
    ensure(20);
    draw(`${p.name}`, 40, y, 10);
    draw(`${p.qty} pcs`, 280, y, 10);
    draw(fmtRp(p.omzet), 400, y, 10, true);
    y -= 14;
  }
  y -= 10;

  ensure(80);
  draw("PEMBAYARAN (PAID)", 40, y, 11, true);
  y -= 16;
  for (const [k, v] of Object.entries(opts.report.byPay)) {
    draw(`${k}: ${fmtRp(v)}`, 40, y, 10);
    y -= 14;
  }
  y -= 8;

  ensure(160);
  draw("RANKING SALES", 40, y, 11, true);
  y -= 16;
  opts.report.ranking.forEach((s, i) => {
    ensure(16);
    draw(`${i + 1}. ${s.nama}  —  ${s.qty} pcs  ·  ${fmtRp(s.revenue)}  ·  ${s.count} trx`, 40, y, 10);
    y -= 14;
  });
  y -= 12;

  const days = Object.entries(opts.report.byDay).sort((a, b) => a[0].localeCompare(b[0]));
  if (days.length) {
    ensure(140);
    draw("GRAFIK PCS PER HARI", 40, y, 11, true);
    y -= 8;
    const max = Math.max(...days.map((d) => d[1]), 1);
    const barW = Math.min(24, 480 / days.length);
    days.forEach((d, i) => {
      const h = Math.max(2, (d[1] / max) * 70);
      page.drawRectangle({
        x: 40 + i * (barW + 4),
        y: y - 80,
        width: barW,
        height: h,
        color: colorTeal(),
      });
    });
    y -= 100;
    draw(`${fmtDateLongId(days[0][0])}  →  ${fmtDateLongId(days[days.length - 1][0])}`, 40, y, 8, false, colorMuted());
    y -= 20;
  }

  ensure(80);
  draw("FOLLOW-UP", 40, y, 11, true);
  y -= 16;
  const follows = Object.entries(opts.report.followSummary);
  if (!follows.length) draw("Tidak ada follow-up pada periode ini.", 40, y, 10, false, colorMuted());
  else {
    for (const [st, n] of follows) {
      draw(`${st}: ${n}`, 40, y, 10);
      y -= 14;
    }
  }
  y -= 16;
  draw("Komisi sales: " + fmtRp(opts.report.commissionByRole.SALES), 40, y, 10);
  y -= 14;
  draw("Komisi leader: " + fmtRp(opts.report.commissionByRole.LEADER), 40, y, 10);
  y -= 28;
  draw("Henima Scent  ·  Laporan dibuat oleh Gercep", 40, 36, 8, false, colorMuted());

  return doc.save();
}

export function reportToCsv(report: SalesReport) {
  const lines = [
    "metric,value",
    `periode,${report.range.label}`,
    `transaksi,${report.totalOrders}`,
    `pcs,${report.totalQty}`,
    `omzet,${report.totalRevenue}`,
    `customer_baru,${report.newCustomers}`,
    `repeat,${report.repeatCustomers}`,
    `komisi,${report.totalCommission}`,
    "",
    "ranking,nama,pcs,omzet,trx",
    ...report.ranking.map((s, i) => `${i + 1},${s.nama},${s.qty},${s.revenue},${s.count}`),
    "",
    "produk,pcs,omzet",
    ...report.byProduct.map((p) => `${p.name},${p.qty},${p.omzet}`),
  ];
  return lines.join("\n");
}
