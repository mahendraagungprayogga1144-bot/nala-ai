import type { BankAccount } from "@/lib/payment/config";
import { fmtRupiah } from "@/lib/payment/config";

export type InvoiceData = {
  invoiceId: string;
  status: string;
  plan: string;
  amount: number;
  method: string | null;
  createdAt: string;
  confirmedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  customerName: string;
  customerEmail: string;
  bankAccounts: BankAccount[];
  companyName?: string;
  supportEmail?: string;
  appUrl?: string;
};

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDateId(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Printable invoice HTML (browser Print → Save as PDF). */
export function buildInvoiceHtml(data: InvoiceData) {
  const banks = (data.bankAccounts || [])
    .map(
      (b) =>
        `<tr><td>${esc(b.bank)}</td><td style="font-family:ui-monospace,monospace">${esc(b.number)}</td><td>${esc(b.holder)}</td></tr>`,
    )
    .join("");

  const statusLabel =
    data.status === "paid" ? "LUNAS" : data.status === "pending" ? "MENUNGGU" : data.status.toUpperCase();

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${esc(data.invoiceId)} — Gercep AI</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #111; margin: 0; padding: 32px; background: #fff; }
    .wrap { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .muted { color: #666; font-size: 13px; }
    .row { display: flex; justify-content: space-between; gap: 24px; margin: 28px 0; }
    .box { border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #eee; }
    th { color: #666; font-weight: 600; font-size: 11px; text-transform: uppercase; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700;
      background: ${data.status === "paid" ? "#dcfce7" : "#fef3c7"}; color: ${data.status === "paid" ? "#166534" : "#92400e"}; }
    .total { font-size: 20px; font-weight: 800; }
    .actions { margin-top: 28px; display: flex; gap: 10px; }
    button, .btn { border: 1px solid #ddd; background: #111; color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 13px; cursor: pointer; text-decoration: none; }
    .btn-secondary { background: #fff; color: #111; }
    @media print {
      .actions { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="row" style="align-items:flex-start">
      <div>
        <h1>${esc(data.companyName || "Gercep AI")}</h1>
        <p class="muted">Invoice langganan SaaS</p>
        ${data.supportEmail ? `<p class="muted">${esc(data.supportEmail)}</p>` : ""}
        ${data.appUrl ? `<p class="muted">${esc(data.appUrl)}</p>` : ""}
      </div>
      <div style="text-align:right">
        <span class="badge">${statusLabel}</span>
        <p style="margin:10px 0 0;font-family:ui-monospace,monospace;font-size:13px">${esc(data.invoiceId)}</p>
        <p class="muted">Dibuat ${fmtDateId(data.createdAt)}</p>
        ${data.confirmedAt ? `<p class="muted">Dikonfirmasi ${fmtDateId(data.confirmedAt)}</p>` : ""}
      </div>
    </div>

    <div class="row">
      <div class="box" style="flex:1">
        <p class="muted" style="margin:0 0 6px">Ditagihkan kepada</p>
        <p style="margin:0;font-weight:700">${esc(data.customerName)}</p>
        <p class="muted" style="margin:4px 0 0">${esc(data.customerEmail)}</p>
      </div>
      <div class="box" style="flex:1">
        <p class="muted" style="margin:0 0 6px">Detail paket</p>
        <p style="margin:0;font-weight:700">${esc(data.plan.toUpperCase())}</p>
        <p class="muted" style="margin:4px 0 0">Metode: ${esc(data.method || "transfer_manual")}</p>
        ${data.periodStart ? `<p class="muted" style="margin:4px 0 0">Periode: ${fmtDateId(data.periodStart)} – ${fmtDateId(data.periodEnd)}</p>` : ""}
      </div>
    </div>

    <div class="box">
      <table>
        <thead><tr><th>Deskripsi</th><th>Jumlah</th></tr></thead>
        <tbody>
          <tr>
            <td>Langganan Gercep AI — paket ${esc(data.plan.toUpperCase())} (30 hari)</td>
            <td class="total">${esc(fmtRupiah(Number(data.amount)))}</td>
          </tr>
        </tbody>
      </table>
    </div>

    ${
      banks
        ? `<div class="box" style="margin-top:16px">
      <p class="muted" style="margin:0 0 6px">Rekening tujuan (referensi)</p>
      <table>
        <thead><tr><th>Bank</th><th>Nomor</th><th>Atas nama</th></tr></thead>
        <tbody>${banks}</tbody>
      </table>
    </div>`
        : ""
    }

    <p class="muted" style="margin-top:24px;line-height:1.5">
      Dokumen ini adalah bukti tagihan/konfirmasi pembayaran Gercep AI.
      Simpan sebagai PDF lewat Print → Save as PDF.
    </p>

    <div class="actions">
      <button type="button" onclick="window.print()">Cetak / Simpan PDF</button>
      <a class="btn btn-secondary" href="/dashboard/upgrade">Kembali ke Upgrade</a>
    </div>
  </div>
</body>
</html>`;
}
