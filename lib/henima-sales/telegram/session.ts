import type { Actor, PaymentMethod, PaymentStatus, ProductRow, SaleLine } from "../types";
import { paymentLabel, priceAgainstRetail } from "../types";
import { UNLINKED_MSG } from "../sales-guide";
import { helpText } from "./menu";
import type { FounderCommand } from "./founder-ops";
import { fmtDiscount, fmtRp } from "../money";
import { cleanProductLabel } from "../labels";
import type { ExpenseDraft, ExpenseSnap } from "./expense-nl";

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

export type SessionMemory = {
  lastUser?: string;
  topic?: string;
  summary?: string;
  turns?: { role: "user" | "assistant"; text: string }[];
  pending?: { command: string; label: string };
  expense?: ExpenseSnap | null;
  crud?: ExpenseDraft | null;
};

export type Session = {
  state: BotState;
  draft: Draft;
  memory?: SessionMemory;
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
  | { type: "send_pdf"; kind: string; from?: string; to?: string }
  | { type: "send_nota"; orderId?: string; query?: string }
  | { type: "send_riwayat" }
  | { type: "send_target" }
  | { type: "save_expense"; amount: number; note: string; expenseDate?: string }
  | { type: "apply_expense"; draft: ExpenseDraft }
  | { type: "send_expenses"; kind: string; from?: string; to?: string }
  | { type: "recruit_sales"; nama: string }
  | { type: "send_team" }
  | { type: "send_briefing"; query?: string; kind?: string; from?: string; to?: string }
  | { type: "run_founder"; cmd: FounderCommand }
  | { type: "send_file"; filename: string; content: string; caption?: string; mime?: string; encoding?: "utf8" | "base64" }
  | { type: "link_invite"; code: string }
  | { type: "noop" };

export function connectedStatusText(actor: Actor, extraHelp?: string) {
  const lines = [
    "Status akun: CONNECTED",
    `Sales: ${actor.nama}`,
    `Role: ${actor.role}`,
    `Bisnis: ${actor.businessName}`,
  ];
  if (actor.tagline?.trim()) lines.push(actor.tagline.trim());
  if (actor.role === "FOUNDER") {
    lines.push("Akun founder terkunci. Jangan pinjamkan Telegram/HP ini ke sales.");
  }
  lines.push("");
  lines.push(extraHelp || "Tekan menu di bawah, atau ketik santai. /help untuk daftar lengkap.");
  return lines.join("\n");
}

export const HELP_TEXT = helpText({
  staffId: "s1",
  businessId: "b1",
  businessName: "Henima",
  ownerUserId: "u1",
  userId: "u3",
  telegramUserId: 3,
  role: "SALES",
  nama: "Sales",
  leaderId: null,
});

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

export function formatOrderItemsLabel(items?: { product_name_snapshot: string | null; qty: number }[]) {
  if (!items?.length) return "Produk";
  const qtyByName = new Map<string, number>();
  for (const i of items) {
    const name = cleanProductLabel(i.product_name_snapshot || "Produk");
    qtyByName.set(name, (qtyByName.get(name) || 0) + (Number(i.qty) || 1));
  }
  return [...qtyByName.entries()].map(([name, qty]) => `${name} × ${qty}`).join(" + ");
}

export function customerNameFromNote(catatan?: string | null) {
  const t = (catatan || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const m = t.match(
    /(?:atas\s+nama|a\/n|\bnama|\bname|\bfor|\bpara)\s+([\p{L}][\p{L}'.-]{1,40}(?:\s+[\p{L}][\p{L}'.-]{1,20}){0,3})/iu,
  );
  if (!m?.[1]) return "";
  const stop = /^(no|telp|hp|wa|phone|harga|price|tf|qris|cash|tunai)$/i;
  const parts = m[1].split(/\s+/).filter((p) => !stop.test(p));
  return parts.join(" ").trim();
}

export function formatRiwayatCard(opts: {
  dateLabel: string;
  customerName?: string | null;
  itemsLabel: string;
  total: number;
}) {
  const name = (opts.customerName || "").trim() || "Tanpa nama";
  return `${opts.dateLabel}\n${name}\n${opts.itemsLabel} — ${fmtRp(opts.total)}`;
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
