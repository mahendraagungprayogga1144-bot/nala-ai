import {
  escapeHtml,
  fmtRpFull,
  formatWibNow,
} from "@/app/dashboard/inventory/lib/export-helpers";
import type { AnalitikInsight, AnalitikTxDetail, DailyPoint, MonthlyPoint, PlRow } from "../page";

type Kpi = {
  omzet: number;
  omzetPrev: number;
  beban: number;
  bebanPrev: number;
  laba: number;
  labaPrev: number;
  margin: number;
  marginPrev: number;
  orderCount: number;
  orderCountPrev: number;
  avgOrder: number;
  txCount: number;
  retailOmzet: number;
};

type CategoryRow = {
  name: string;
  amount: number;
  amountPrev: number;
  share: number;
};

type BusinessRow = {
  name: string;
  type: string | null;
  omzet: number;
  omzetPrev: number;
  beban: number;
  laba: number;
  margin: number;
  orderCount: number;
};

export type AnalitikPdfData = {
  businessLabel: string;
  ownerName: string;
  reportAddress: string;
  reportNo: string;
  monthLabel: string;
  previousMonthLabel: string;
  kpi: Kpi;
  insights: AnalitikInsight[];
  plRows: PlRow[];
  daily: DailyPoint[];
  monthly: MonthlyPoint[];
  categories: CategoryRow[];
  incomes: CategoryRow[];
  businesses: BusinessRow[];
  recentTx: AnalitikTxDetail[];
};

function money(value: number) {
  return value < 0 ? `(${fmtRpFull(Math.abs(value))})` : fmtRpFull(value);
}

function changePct(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function barChartSvg(
  values: number[],
  labels: string[],
  color: string,
  width = 520,
  height = 120,
) {
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);
  const padL = 8;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const gap = 2;
  const barW = Math.max(2, (chartW - gap * Math.max(values.length - 1, 0)) / Math.max(values.length, 1));
  const bars = values
    .map((v, i) => {
      const h = Math.max(1, (Math.abs(v) / max) * chartH);
      const x = padL + i * (barW + gap);
      const y = padT + (chartH - h);
      const showLabel = values.length <= 16 || i % Math.ceil(values.length / 12) === 0 || i === values.length - 1;
      const label = showLabel
        ? `<text x="${x + barW / 2}" y="${height - 6}" text-anchor="middle" font-size="7" fill="#64748b">${escapeHtml(labels[i] || "")}</text>`
        : "";
      return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="1.5" fill="${color}"/>${label}`;
    })
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg" role="img">${bars}</svg>`;
}

function dualBarChartSvg(
  masuk: number[],
  keluar: number[],
  labels: string[],
  width = 520,
  height = 130,
) {
  const max = Math.max(...masuk, ...keluar, 1);
  const padL = 8;
  const padR = 8;
  const padT = 10;
  const padB = 24;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const groupW = chartW / Math.max(labels.length, 1);
  const barW = Math.max(3, groupW * 0.32);
  const bars = labels
    .map((label, i) => {
      const x0 = padL + i * groupW + groupW * 0.15;
      const hm = Math.max(1, (masuk[i] / max) * chartH);
      const hk = Math.max(1, (keluar[i] / max) * chartH);
      return `
        <rect x="${x0}" y="${padT + chartH - hm}" width="${barW}" height="${hm}" rx="1.5" fill="#0d9488"/>
        <rect x="${x0 + barW + 2}" y="${padT + chartH - hk}" width="${barW}" height="${hk}" rx="1.5" fill="#d97706"/>
        <text x="${x0 + barW}" y="${height - 6}" text-anchor="middle" font-size="7" fill="#64748b">${escapeHtml(label)}</text>
      `;
    })
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

const STYLES = `
  @page { size: A4; margin: 11mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px 18px; color: #172033; font-family: "Segoe UI", Arial, sans-serif; font-size: 10px; line-height: 1.4; }
  .topbar { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding-bottom: 10px; border-bottom: 3px solid #1d4ed8; }
  .brand-kicker { color: #1d4ed8; font-size: 8px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  .title { margin-top: 2px; font-size: 18px; font-weight: 800; color: #0f172a; }
  .sub { margin-top: 2px; color: #64748b; }
  .meta { text-align: right; color: #475569; line-height: 1.55; min-width: 180px; }
  .badge { display: inline-block; margin-top: 4px; padding: 2px 7px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 8px; font-weight: 700; letter-spacing: .04em; }
  h1 { margin: 12px 0 2px; text-align: center; font-size: 14px; letter-spacing: .1em; color: #0f172a; }
  .subtitle { margin: 0 0 12px; text-align: center; color: #64748b; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-bottom: 12px; }
  .kpi { padding: 8px; border: 1px solid #dbe3ef; border-radius: 7px; background: linear-gradient(180deg, #f8fafc, #fff); }
  .kpi-label { color: #64748b; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
  .kpi-value { margin-top: 4px; color: #0f172a; font: 800 12px ui-monospace, monospace; }
  .kpi-sub { margin-top: 2px; color: #64748b; font-size: 8px; }
  h2 { margin: 14px 0 6px; padding-left: 7px; border-left: 3px solid #1d4ed8; font-size: 11px; color: #0f172a; }
  .chart-box { padding: 8px 8px 4px; border: 1px solid #dbe3ef; border-radius: 7px; background: #fff; margin-bottom: 8px; }
  .chart-legend { display: flex; gap: 12px; margin: 0 0 4px; color: #64748b; font-size: 8px; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
  .insights { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .insight { break-inside: avoid; padding: 7px 8px; border: 1px solid #dbe3ef; border-radius: 5px; background: #f8fafc; }
  .insight.good { border-left: 3px solid #059669; }
  .insight.warn { border-left: 3px solid #d97706; }
  .insight.bad { border-left: 3px solid #e11d48; }
  .insight.info { border-left: 3px solid #0284c7; }
  .insight-title { font-weight: 700; color: #1e293b; }
  .insight-body { margin-top: 2px; color: #64748b; font-size: 9px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th, td { padding: 5px 6px; border: 1px solid #dbe3ef; vertical-align: top; }
  th { background: #eff6ff; color: #334155; font-size: 8px; text-transform: uppercase; letter-spacing: .03em; }
  td.num, th.num { text-align: right; font-family: ui-monospace, monospace; white-space: nowrap; }
  tr.section td { background: #eaf2ff; color: #1d4ed8; font-size: 8px; font-weight: 750; letter-spacing: .06em; }
  tr.total td { background: #f8fafc; font-weight: 750; }
  tr.final td { background: #ecfdf5; color: #047857; font-weight: 800; border-top: 2px solid #10b981; }
  .pos { color: #047857; }
  .neg { color: #be123c; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start; }
  .muted { color: #64748b; font-size: 8px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 28px; page-break-inside: avoid; }
  .sign-box { text-align: center; }
  .sign-line { margin: 42px auto 6px; width: 70%; border-top: 1px solid #94a3b8; }
  .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #dbe3ef; text-align: center; color: #94a3b8; font-size: 8px; }
`;

export function buildAnalitikPdfHtml(data: AnalitikPdfData): string {
  const printedAt = formatWibNow();
  const dailyVals = data.daily.map((d) => d.omzet);
  const dailyLabels = data.daily.map((d) => d.day);
  const monthlyMasuk = data.monthly.map((m) => m.masuk);
  const monthlyKeluar = data.monthly.map((m) => m.keluar);
  const monthlyLabels = data.monthly.map((m) => m.label);

  const kpiCards = [
    ["Omzet", data.kpi.omzet, data.kpi.omzetPrev],
    ["Beban", data.kpi.beban, data.kpi.bebanPrev],
    [data.kpi.laba >= 0 ? "Laba Bersih" : "Rugi Bersih", data.kpi.laba, data.kpi.labaPrev],
  ] as const;

  const kpiHtml = kpiCards
    .map(([label, current, previous]) => {
      const d = changePct(current, previous);
      return `
      <div class="kpi">
        <div class="kpi-label">${escapeHtml(label)}</div>
        <div class="kpi-value">${money(current)}</div>
        <div class="kpi-sub">Lalu ${money(previous)} · ${d >= 0 ? "+" : ""}${d}%</div>
      </div>`;
    })
    .join("");

  const insightHtml = data.insights
    .slice(0, 6)
    .map(
      (item) => `
      <div class="insight ${item.tone}">
        <div class="insight-title">${escapeHtml(item.title)}</div>
        <div class="insight-body">${escapeHtml(item.body)}</div>
      </div>`,
    )
    .join("");

  const plHtml = data.plRows
    .map((row) => {
      if (row.kind === "header") {
        return `<tr class="section"><td colspan="5">${escapeHtml(row.name)}</td></tr>`;
      }
      const difference = row.amount - row.amountPrev;
      const percentage = changePct(row.amount, row.amountPrev);
      const final = row.name.includes("LABA") || row.name.includes("RUGI");
      return `
        <tr class="${final ? "final" : row.kind === "total" ? "total" : ""}">
          <td>${escapeHtml(row.name)}</td>
          <td class="num">${money(row.amount)}</td>
          <td class="num">${money(row.amountPrev)}</td>
          <td class="num ${difference >= 0 ? "pos" : "neg"}">${difference === 0 ? "—" : money(difference)}</td>
          <td class="num">${percentage >= 0 ? "+" : ""}${percentage}%</td>
        </tr>`;
    })
    .join("");

  const cashHtml = data.monthly
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.label)}</td>
        <td class="num">${money(row.masuk)}</td>
        <td class="num">${money(row.keluar)}</td>
        <td class="num ${row.laba >= 0 ? "pos" : "neg"}">${money(row.laba)}</td>
        <td class="num">${money(row.saldo)}</td>
      </tr>`,
    )
    .join("");

  const categoryHtml = data.categories
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td class="num">${row.share}%</td>
        <td class="num">${money(row.amount)}</td>
        <td class="num">${money(row.amountPrev)}</td>
      </tr>`,
    )
    .join("");

  const incomeHtml = data.incomes
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td class="num">${row.share}%</td>
        <td class="num">${money(row.amount)}</td>
        <td class="num">${money(row.amountPrev)}</td>
      </tr>`,
    )
    .join("");

  const businessHtml = data.businesses
    .slice()
    .sort((a, b) => b.omzet - a.omzet)
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.name)}<br/><span class="muted">${escapeHtml(row.type || "Umum")}</span></td>
        <td class="num">${money(row.omzet)}</td>
        <td class="num">${money(row.beban)}</td>
        <td class="num ${row.laba >= 0 ? "pos" : "neg"}">${money(row.laba)}</td>
        <td class="num">${row.margin}%</td>
        <td class="num">${row.orderCount}</td>
      </tr>`,
    )
    .join("");

  const txHtml = data.recentTx
    .map(
      (row, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.businessName)}</td>
        <td>${escapeHtml(row.category)}<br/><span class="muted">${escapeHtml(row.description.slice(0, 60))}</span></td>
        <td>${escapeHtml(row.type)}</td>
        <td class="num ${row.type === "pengeluaran" ? "neg" : "pos"}">${money(row.amount)}</td>
      </tr>`,
    )
    .join("");

  const addressLine = data.reportAddress
    ? `<div class="sub">${escapeHtml(data.reportAddress)}</div>`
    : "";

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(data.reportNo)} · ${escapeHtml(data.monthLabel)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="topbar">
    <div>
      <div class="brand-kicker">Gercep AI · Laporan Resmi</div>
      <div class="title">${escapeHtml(data.businessLabel)}</div>
      ${addressLine}
      <div class="sub">Disiapkan untuk: ${escapeHtml(data.ownerName)}</div>
    </div>
    <div class="meta">
      No. Laporan: <strong>${escapeHtml(data.reportNo)}</strong><br/>
      Periode: ${escapeHtml(data.monthLabel)}<br/>
      Pembanding: ${escapeHtml(data.previousMonthLabel)}<br/>
      Dicetak: ${printedAt} WIB<br/>
      <span class="badge">STATUS: FINAL</span>
    </div>
  </div>

  <h1>LAPORAN ANALITIK BULANAN</h1>
  <p class="subtitle">Omzet · Laba Rugi · Arus Kas · Insight otomatis · Detail transaksi</p>

  <div class="kpis">
    ${kpiHtml}
    <div class="kpi">
      <div class="kpi-label">Margin & Order</div>
      <div class="kpi-value">${data.kpi.margin}% · ${data.kpi.orderCount}</div>
      <div class="kpi-sub">Avg ${money(data.kpi.avgOrder)} · ${data.kpi.txCount} transaksi${data.kpi.retailOmzet > 0 ? ` · AI Kasir ${money(data.kpi.retailOmzet)}` : ""}</div>
    </div>
  </div>

  ${insightHtml ? `<h2>Insight Otomatis</h2><div class="insights">${insightHtml}</div>` : ""}

  <div class="two-col" style="margin-top:10px">
    <div>
      <h2>Tren Omzet Harian</h2>
      <div class="chart-box">
        <div class="chart-legend"><span><span class="dot" style="background:#0d9488"></span>Omzet per tanggal</span></div>
        ${barChartSvg(dailyVals, dailyLabels, "#0d9488")}
      </div>
    </div>
    <div>
      <h2>Arus Kas 12 Bulan</h2>
      <div class="chart-box">
        <div class="chart-legend">
          <span><span class="dot" style="background:#0d9488"></span>Masuk</span>
          <span><span class="dot" style="background:#d97706"></span>Keluar</span>
        </div>
        ${dualBarChartSvg(monthlyMasuk, monthlyKeluar, monthlyLabels)}
      </div>
    </div>
  </div>

  <h2>Laporan Laba Rugi Komparatif</h2>
  <table>
    <thead>
      <tr>
        <th>Akun / Kategori</th>
        <th class="num">${escapeHtml(data.monthLabel)}</th>
        <th class="num">${escapeHtml(data.previousMonthLabel)}</th>
        <th class="num">Selisih</th>
        <th class="num">%</th>
      </tr>
    </thead>
    <tbody>${plHtml}</tbody>
  </table>

  <h2>Tabel Arus Kas 12 Bulan</h2>
  <table>
    <thead>
      <tr>
        <th>Periode</th>
        <th class="num">Kas Masuk</th>
        <th class="num">Kas Keluar</th>
        <th class="num">Net</th>
        <th class="num">Saldo Berjalan</th>
      </tr>
    </thead>
    <tbody>${cashHtml}</tbody>
  </table>

  <div class="two-col">
    <div>
      <h2>Sumber Pendapatan</h2>
      <table>
        <thead><tr><th>Kategori</th><th class="num">Porsi</th><th class="num">Periode Ini</th><th class="num">Periode Lalu</th></tr></thead>
        <tbody>${incomeHtml || `<tr><td colspan="4">Belum ada pendapatan.</td></tr>`}</tbody>
      </table>
    </div>
    <div>
      <h2>Komposisi Beban</h2>
      <table>
        <thead><tr><th>Kategori</th><th class="num">Porsi</th><th class="num">Periode Ini</th><th class="num">Periode Lalu</th></tr></thead>
        <tbody>${categoryHtml || `<tr><td colspan="4">Belum ada beban.</td></tr>`}</tbody>
      </table>
    </div>
  </div>

  <h2>Performa per Bisnis</h2>
  <table>
    <thead>
      <tr>
        <th>Bisnis</th>
        <th class="num">Omzet</th>
        <th class="num">Beban</th>
        <th class="num">Laba</th>
        <th class="num">Margin</th>
        <th class="num">Order</th>
      </tr>
    </thead>
    <tbody>${businessHtml || `<tr><td colspan="6">Belum ada data bisnis.</td></tr>`}</tbody>
  </table>

  <h2>Detail Transaksi Terbesar (Top 20)</h2>
  <table>
    <thead>
      <tr>
        <th class="num">No</th>
        <th>Tanggal</th>
        <th>Bisnis</th>
        <th>Kategori / Keterangan</th>
        <th>Jenis</th>
        <th class="num">Nominal</th>
      </tr>
    </thead>
    <tbody>${txHtml || `<tr><td colspan="6">Belum ada transaksi di periode ini.</td></tr>`}</tbody>
  </table>

  <div class="sign">
    <div class="sign-box">
      <div class="muted">Dibuat oleh</div>
      <div class="sign-line"></div>
      <div><strong>${escapeHtml(data.ownerName)}</strong></div>
      <div class="muted">Owner / Penanggung jawab</div>
    </div>
    <div class="sign-box">
      <div class="muted">Diperiksa / Disetujui</div>
      <div class="sign-line"></div>
      <div><strong>( ........................ )</strong></div>
      <div class="muted">Mengetahui</div>
    </div>
  </div>

  <div class="footer">
    ${escapeHtml(data.reportNo)} · Sumber: Keuangan Bisnis + Kasir F&amp;B + AI Kasir (tanpa double count).<br/>
    Generated by Gercep AI · Cetak → Save as PDF · Dokumen ini bersifat ringkasan manajemen, bukan laporan pajak formal.
  </div>
</body>
</html>`;
}
