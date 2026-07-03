import { escapeHtml, formatWibNow } from "../../inventory/lib/export-helpers";

export type ReceiptItem = {
  nama: string;
  qty: number;
  harga: number;
};

export type KasirReceiptData = {
  businessName: string;
  orderNo: string;
  kasirName?: string;
  items: ReceiptItem[];
  subtotal: number;
  diskon: number;
  total: number;
  metodeBayar: string;
  catatan?: string | null;
  bayar?: number;
  kembali?: number;
};

const METODE_LABEL: Record<string, string> = {
  tunai: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
};

function thermalStyles(widthMm: number): string {
  const fontSize = widthMm <= 58 ? "10px" : "11px";
  const small = widthMm <= 58 ? "9px" : "10px";
  return `
    @page { size: ${widthMm}mm auto; margin: 2mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fontSize};
      line-height: 1.4;
      color: #000;
      width: ${widthMm}mm;
      padding: 3mm 2mm;
      background: #fff;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .title { font-size: ${widthMm <= 58 ? "12px" : "14px"}; font-weight: 700; letter-spacing: 0.03em; }
    .line { border-top: 1px dashed #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; gap: 4px; }
    .item { margin: 4px 0; }
    .item-name { font-weight: 700; }
    .item-detail { display: flex; justify-content: space-between; font-size: ${small}; }
    .total-row { font-weight: 700; font-size: ${widthMm <= 58 ? "11px" : "12px"}; }
    .footer { margin-top: 8px; font-size: ${small}; text-align: center; }
    .muted { color: #333; font-size: ${small}; }
  `;
}

function fmt(n: number): string {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export function buildKasirReceiptHtml(data: KasirReceiptData, widthMm = 58): string {
  const w = Math.min(Math.max(widthMm, 48), 120);
  const metode = METODE_LABEL[data.metodeBayar] || data.metodeBayar;
  const waktu = formatWibNow();

  const itemLines = data.items.map(item => `
    <div class="item">
      <div class="item-name">${escapeHtml(item.nama)}</div>
      <div class="item-detail">
        <span>${item.qty} x ${fmt(item.harga)}</span>
        <span class="bold">${fmt(item.harga * item.qty)}</span>
      </div>
    </div>
  `).join("");

  const bayarBlock = data.bayar != null && data.bayar > 0 ? `
    <div class="row"><span>Bayar</span><span>${fmt(data.bayar)}</span></div>
    ${data.kembali != null && data.kembali > 0 ? `<div class="row"><span>Kembali</span><span>${fmt(data.kembali)}</span></div>` : ""}
  ` : "";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Struk ${escapeHtml(data.orderNo)}</title>
    <style>${thermalStyles(w)}</style></head><body>
    <div class="center title">${escapeHtml(data.businessName.toUpperCase())}</div>
    <div class="center muted" style="margin-top:2px">Gercep AI Kasir</div>
    <div class="line"></div>
    <div class="row"><span>No. Nota</span><span>${escapeHtml(data.orderNo)}</span></div>
    <div class="row"><span>Tanggal</span><span>${waktu}</span></div>
    ${data.kasirName ? `<div class="row"><span>Kasir</span><span>${escapeHtml(data.kasirName)}</span></div>` : ""}
    <div class="line"></div>
    ${itemLines}
    <div class="line"></div>
    <div class="row"><span>Subtotal</span><span>${fmt(data.subtotal)}</span></div>
    ${data.diskon > 0 ? `<div class="row"><span>Diskon</span><span>-${fmt(data.diskon)}</span></div>` : ""}
    <div class="row total-row" style="margin-top:4px"><span>TOTAL</span><span>${fmt(data.total)}</span></div>
    ${bayarBlock}
    <div class="line"></div>
    <div class="row"><span>Metode</span><span>${escapeHtml(metode)}</span></div>
    ${data.catatan ? `<div style="margin-top:4px" class="muted">Catatan: ${escapeHtml(data.catatan)}</div>` : ""}
    <div class="footer">
      Terima kasih atas kunjungannya!<br/>
      Simpan struk sebagai bukti pembayaran
    </div>
  </body></html>`;
}

export function shortOrderNo(orderId: string): string {
  const clean = orderId.replace(/-/g, "").toUpperCase();
  return "NTA-" + clean.slice(0, 8);
}
