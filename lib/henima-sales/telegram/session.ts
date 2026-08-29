import type { Actor, PaymentMethod, PaymentStatus } from "../types";

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
  customerId?: string;
  customerName?: string;
  city?: string;
  notes?: string;
  productId?: string;
  productName?: string;
  suggestedPrice?: number;
  quantity?: number;
  unitPrice?: number;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  idempotencyKey?: string;
  photoFileId?: string;
  photoCaption?: string;
  orderId?: string;
  followupCustomerId?: string;
  followupDate?: string;
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
  | { type: "link_invite"; code: string }
  | { type: "noop" };

export const UNLINKED_MSG =
  "Telegram Anda belum terdaftar. Hubungi admin Henima.";

export const HELP_TEXT = `Perintah Henima Sales:

/input — catat penjualan
/riwayat — lihat, edit, hapus transaksi
/customer — cari customer
/rekap — ringkasan penjualan
/target — target & pencapaian
/followup — buat reminder
/pdf — laporan PDF
/help — bantuan

Sales cukup pakai Telegram. KPI & dashboard di modul Henima Sales.`;

export function newDraft(): Draft {
  return { paymentStatus: "PAID" };
}

export function formatConfirm(d: Draft, actor: Actor, dateLabel: string) {
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
    `Produk:\n${d.productName || "—"}`,
    "",
    `Quantity:\n${d.quantity || 0} pcs`,
    "",
    `Harga:\nRp${Math.round(d.unitPrice || 0).toLocaleString("id-ID")}`,
    "",
    `Total:\nRp${Math.round((d.quantity || 0) * (d.unitPrice || 0)).toLocaleString("id-ID")}`,
    "",
    `Pembayaran:\n${d.paymentMethod || "—"} (${d.paymentStatus || "PAID"})`,
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
