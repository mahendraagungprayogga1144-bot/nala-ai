/** Shared retail receipt print (AI Kasir) — thermal-style modern struk. */

export type ReceiptLine = {
  name: string;
  qty: number;
  price: number;
};

export function printRetailReceipt(opts: {
  storeName: string;
  today: string;
  metodeBayar: string;
  staffName?: string | null;
  lines: ReceiptLine[];
  total: number;
  diskon?: number;
  voided?: boolean;
  orderId?: string | null;
  bayar?: number | null;
  kembali?: number | null;
  printedAt?: Date;
}) {
  try {
    const w = window.open("", "_blank", "width=360,height=720");
    if (!w) return;

    const now = opts.printedAt || new Date();
    const waktu = now.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const subtotal = opts.lines.reduce((s, c) => s + c.price * c.qty, 0);
    const diskon = Number(opts.diskon) || 0;
    const itemCount = opts.lines.reduce((s, c) => s + c.qty, 0);
    const metodeLabel = labelMetode(opts.metodeBayar);
    const receiptNo = opts.orderId
      ? opts.orderId.replace(/-/g, "").slice(0, 10).toUpperCase()
      : now.getTime().toString(36).toUpperCase().slice(-8);

    const rows = opts.lines
      .map((c) => {
        const lineTotal = c.price * c.qty;
        return `
        <div class="item">
          <div class="item-name">${escapeHtml(c.name)}</div>
          <div class="item-row">
            <span>${c.qty} × ${fmtRp(c.price)}</span>
            <span class="amt">${fmtRp(lineTotal)}</span>
          </div>
        </div>`;
      })
      .join("");

    const voidBanner = opts.voided
      ? `<div class="void-banner">⚠ TRANSAKSI DIBATALKAN</div>`
      : "";

    const bayarBlock =
      opts.bayar != null && Number(opts.bayar) > 0
        ? `<div class="row"><span>Bayar (${metodeLabel})</span><span class="amt">${fmtRp(Number(opts.bayar))}</span></div>
           <div class="row"><span>Kembali</span><span class="amt">${fmtRp(Number(opts.kembali) || 0)}</span></div>`
        : `<div class="row"><span>Metode</span><span class="amt">${escapeHtml(metodeLabel)}</span></div>`;

    w.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Struk · ${escapeHtml(opts.storeName || "AI Kasir")}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "SF Mono", "Cascadia Mono", "Consolas", "Courier New", monospace;
    font-size: 12px;
    line-height: 1.35;
    color: #111;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ticket {
    width: 80mm;
    max-width: 302px;
    margin: 0 auto;
    padding: 14px 12px 20px;
  }
  .brand {
    text-align: center;
    letter-spacing: 0.28em;
    font-size: 9px;
    font-weight: 700;
    color: #007A4D;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .store {
    text-align: center;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.02em;
    text-transform: uppercase;
    line-height: 1.15;
    margin-bottom: 4px;
  }
  .tagline {
    text-align: center;
    font-size: 10px;
    color: #555;
    margin-bottom: 10px;
  }
  .dash {
    border: none;
    border-top: 1px dashed #222;
    margin: 8px 0;
  }
  .meta {
    font-size: 11px;
    color: #222;
  }
  .meta .row { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
  .meta .lbl { color: #555; }
  .void-banner {
    text-align: center;
    font-weight: 800;
    color: #b42318;
    border: 2px solid #b42318;
    padding: 6px;
    margin: 8px 0;
    letter-spacing: 0.06em;
  }
  .item { margin: 8px 0; }
  .item-name { font-weight: 700; font-size: 12px; }
  .item-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: #333;
    font-size: 11px;
    margin-top: 2px;
  }
  .totals .row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin: 3px 0;
    font-size: 12px;
  }
  .totals .grand {
    font-size: 15px;
    font-weight: 800;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 2px solid #111;
  }
  .amt { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .footer {
    text-align: center;
    margin-top: 12px;
    font-size: 11px;
    color: #333;
  }
  .footer .thanks {
    font-size: 13px;
    font-weight: 800;
    margin-bottom: 4px;
    letter-spacing: 0.04em;
  }
  .footer .note { color: #666; font-size: 10px; line-height: 1.4; }
  .barcode {
    text-align: center;
    margin-top: 10px;
    font-size: 14px;
    letter-spacing: 0.22em;
    font-weight: 700;
  }
  .powered {
    text-align: center;
    margin-top: 10px;
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #007A4D;
    font-weight: 700;
  }
  @media print {
    body { background: #fff; }
    .ticket { padding: 4px 6px 10px; }
  }
</style>
</head>
<body>
  <div class="ticket">
    <div class="brand">GERCEP · AI KASIR</div>
    <div class="store">${escapeHtml(opts.storeName || "Toko")}</div>
    <div class="tagline">Struk penjualan retail</div>
    ${voidBanner}
    <hr class="dash"/>
    <div class="meta">
      <div class="row"><span class="lbl">No. Struk</span><span>${escapeHtml(receiptNo)}</span></div>
      <div class="row"><span class="lbl">Tanggal</span><span>${escapeHtml(waktu)}</span></div>
      <div class="row"><span class="lbl">Kasir</span><span>${escapeHtml(opts.staffName || "Owner")}</span></div>
      <div class="row"><span class="lbl">Item</span><span>${itemCount} pcs</span></div>
    </div>
    <hr class="dash"/>
    ${rows}
    <hr class="dash"/>
    <div class="totals">
      <div class="row"><span>Subtotal</span><span class="amt">${fmtRp(subtotal)}</span></div>
      ${diskon > 0 ? `<div class="row"><span>Diskon</span><span class="amt">−${fmtRp(diskon)}</span></div>` : ""}
      <div class="row grand"><span>TOTAL</span><span class="amt">${fmtRp(opts.total)}</span></div>
      ${bayarBlock}
    </div>
    <hr class="dash"/>
    <div class="footer">
      <div class="thanks">TERIMA KASIH</div>
      <div class="note">Barang yang sudah dibeli<br/>tidak dapat dikembalikan.<br/>Simpan struk ini sebagai bukti.</div>
      <div class="barcode">*${escapeHtml(receiptNo)}*</div>
      <div class="powered">Supported by Gercep AI</div>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function(){ window.print(); }, 120);
    };
  </script>
</body>
</html>`);
    w.document.close();
  } catch {
    /* ignore print blockers */
  }
}

function labelMetode(m: string) {
  const map: Record<string, string> = {
    tunai: "Tunai",
    qris: "QRIS",
    transfer: "Transfer",
    debit: "Debit",
  };
  return map[m.toLowerCase()] || m;
}

function fmtRp(n: number) {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
