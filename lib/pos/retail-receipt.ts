/** Shared retail receipt print (AI Kasir). */

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
}) {
  try {
    const w = window.open("", "_blank", "width=320,height=600");
    if (!w) return;
    const rows = opts.lines
      .map(
        (c) =>
          `<tr><td>${escapeHtml(c.name)} x${c.qty}</td><td style="text-align:right">${fmtRp(c.price * c.qty)}</td></tr>`,
      )
      .join("");
    const voidBanner = opts.voided
      ? `<p style="color:#b42318;font-weight:bold;text-align:center">— DIBATALKAN —</p>`
      : "";
    w.document.write(`<!DOCTYPE html><html><head><title>Struk</title>
<style>body{font-family:monospace;font-size:12px;padding:12px;max-width:280px}table{width:100%}td{padding:2px 0}h1{font-size:14px;margin:0 0 8px}</style></head><body>
<h1>${escapeHtml(opts.storeName || "AI Kasir")}</h1>
${voidBanner}
<p>${escapeHtml(opts.today)} · ${escapeHtml(opts.metodeBayar)}${opts.staffName ? ` · ${escapeHtml(opts.staffName)}` : ""}</p>
<table>${rows}</table>
<hr/>
<p><strong>Total ${fmtRp(opts.total)}</strong>${opts.diskon ? ` (diskon ${fmtRp(opts.diskon)})` : ""}</p>
<p style="margin-top:16px;text-align:center">Terima kasih</p>
<script>window.print()</script></body></html>`);
    w.document.close();
  } catch {
    /* ignore print blockers */
  }
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
