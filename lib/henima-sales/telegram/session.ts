import type { Actor, PaymentMethod, PaymentStatus, ProductRow, SaleLine } from "../types";
import { paymentLabel, priceAgainstRetail } from "../types";
import { UNLINKED_MSG, salesHowToText } from "../sales-guide";
import { fmtDiscount } from "../money";

export { UNLINKED_MSG };

export type BotState =
  | "idle"
  | "input_phone"
  | "input_new_name"
  | "input_new_city"
  | "input_new_notes"
  | "input_product"
  | "input_qty"
  | "input_price"
  | "input_pay_method"
  | "input_pay_status"
  | "input_testimonial"
  | "input_confirm"
  | "riwayat"
  | "edit_pick"
  | "delete_confirm"
  | "rekap_pick"
  | "pdf_pick"
  | "followup_phone"
  | "followup_date"
  | "followup_notes"
  | "customer_query";

export type Draft = {
  phone?: string;
  skipPhone?: boolean;
  customerId?: string;
  customerName?: string;
  city?: string;
  notes?: string;
  productId?: string;
  productName?: string;
  suggestedPrice?: number;
  quantity?: number;
  unitPrice?: number;
  lines?: SaleLine[];
  packProductIds?: string[];
  packQty?: number;
  orderTotal?: number;
  discount?: number;
  discountPercent?: number;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  idempotencyKey?: string;
  photoFileId?: string;
  photoCaption?: string;
  orderId?: string;
  followupCustomerId?: string;
  followupDate?: string;
  nlChat?: boolean;
};

export type Session = {
  state: BotState;
  draft: Draft;
};

export type TgUser = { id: number; first_name?: string; username?: string };

export type BotReply = {
  text: string;
  keyboard?: { text: string; data: string }[][];
  parseMode?: "HTML";
};

export type BotEffect =
  | { type: "reply"; reply: BotReply }
  | { type: "confirm_sale" }
  | { type: "delete_order"; orderId: string }
  | { type: "save_photo" }
  | { type: "send_report"; kind: string; from?: string; to?: string }
  | { type: "send_pdf"; kind: string }
  | { type: "send_nota"; orderId?: string; query?: string }
  | { type: "send_riwayat" }
  | { type: "send_target" }
  | { type: "link_invite"; code: string }
  | { type: "noop" };

export function connectedStatusText(actor: Actor, extraHelp?: string) {
  const lines = [
    "Telegram Account: CONNECTED",
    `Sales: ${actor.nama}`,
    `Role: ${actor.role}`,
    `Bisnis: ${actor.businessName}`,
  ];
  if (actor.tagline?.trim()) lines.push(actor.tagline.trim());
  lines.push("");
  lines.push(extraHelp || salesHowToText());
  return lines.join("\n");
}

export const HELP_TEXT = `Perintah Henima Sales:

/input — catat penjualan
/riwayat — lihat, edit, hapus transaksi
/customer — cari customer
/rekap — ringkasan penjualan
/target — target & pencapaian
/followup — buat reminder
/pdf — laporan PDF
/nota — nota / invoice customer (contoh: nota regan)
/help — bantuan

Sales cukup pakai Telegram. Bahasa bebas, contoh:
laku 1 harga 130rb atas nama Regan no 0877... tf
sold 3 afternoon 2 the distance price 149k for Vitha phone 08... cash
laku 2 paket new member harga 250k atas nama Dimas no 08... qris
afternoon dan the distance
Bayar: tf / qris / cash / transfer / bank
rekapan hari ini / recap today
pdf bulan ini
riwayat / history
nota regan / invoice
target / targetku

Belum CONNECTED? Minta kode ke founder, lalu /start KODE`;

export function newDraft(): Draft {
  return { paymentStatus: "PAID" };
}

export function applyLinesToDraft(draft: Draft, lines: SaleLine[]): Draft {
  const total = lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPrice), 0);
  const qtySum = lines.reduce((sum, line) => sum + line.quantity, 0);
  return {
    ...draft,
    lines,
    packProductIds: lines.map((line) => line.productId),
    packQty: lines[0]?.quantity,
    productId: lines[0]?.productId,
    productName: lines.map((line) => `${line.productName} × ${line.quantity}`).join(" + "),
    quantity: qtySum,
    unitPrice: qtySum > 0 ? Math.round(total / qtySum) : draft.unitPrice,
    orderTotal: total,
  };
}

/** Retail line + diskon so nota SUBTOTAL − DISKON = yang dibayar. */
export function applyCatalogPricing(draft: Draft, products: ProductRow[]): Draft {
  const lines = draftSaleLines(draft);
  if (!lines.length || !products.length) return draft;
  try {
    const priced = priceAgainstRetail(lines, products, {
      discount: draft.discount,
      discountPercent: draft.discountPercent,
    });
    if (priced.discount <= 0) return { ...draft, orderTotal: priced.total, discountPercent: 0 };
    return {
      ...applyLinesToDraft({ ...draft, discount: priced.discount, discountPercent: priced.discountPercent }, priced.lines),
      discount: priced.discount,
      discountPercent: priced.discountPercent,
      orderTotal: priced.total,
    };
  } catch {
    return draft;
  }
}

export function draftSaleLines(d: Draft): SaleLine[] {
  if (d.lines?.length) return d.lines;
  if (d.productId && d.quantity && d.unitPrice != null) {
    return [
      {
        productId: d.productId,
        productName: d.productName || "Produk",
        quantity: d.quantity,
        unitPrice: d.unitPrice,
      },
    ];
  }
  return [];
}

export function formatConfirm(d: Draft, actor: Actor, dateLabel: string) {
  const lines = draftSaleLines(d);
  const productBlock = lines.length
    ? lines.map((line) => `${line.productName} × ${line.quantity}`).join("\n")
    : d.productName || "—";
  const goods = lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPrice), 0);
  const discountAmt =
    d.discount ||
    (d.discountPercent ? Math.round(goods * (d.discountPercent / 100)) : 0) ||
    0;
  const total = d.orderTotal ?? Math.max(0, goods - discountAmt) ?? Math.round((d.quantity || 0) * (d.unitPrice || 0));
  const qtyLabel =
    lines.length > 1
      ? lines.map((line) => `${line.quantity} ${line.productName}`).join(" + ")
      : `${d.quantity || 0} pcs`;
  const harga = lines.length > 1 ? goods : d.unitPrice || goods || 0;
  return [
    "================================",
    "TRANSAKSI HENIMA",
    "",
    `Customer:\n${d.customerName || "—"}`,
    "",
    `WhatsApp:\n${d.phone || "—"}`,
    "",
    `Sales:\n${actor.nama}`,
    "",
    `Produk:\n${productBlock}`,
    "",
    `Quantity:\n${qtyLabel}`,
    "",
    `Harga:\nRp${Math.round(harga).toLocaleString("id-ID")}`,
    "",
    ...(discountAmt > 0 ? [`Diskon:\n${fmtDiscount(discountAmt, goods) || `Rp${Math.round(discountAmt).toLocaleString("id-ID")}`}`, ""] : []),
    `Total:\nRp${Math.round(total).toLocaleString("id-ID")}`,
    "",
    `Pembayaran:\n${d.paymentMethod ? paymentLabel(d.paymentMethod) : "—"} (${d.paymentStatus || "PAID"})`,
    "",
    `Testimoni:\n${d.photoFileId ? "1 foto" : "tidak ada"}`,
    "",
    `Tanggal:\n${dateLabel}`,
    "================================",
  ].join("\n");
}

export function kb(rows: { text: string; data: string }[][]): BotReply["keyboard"] {
  return rows;
}
