/** Receipt wording profiles for AI Kasir (toko / cafe / jasa / umum). */

export type ReceiptStyle = "toko" | "cafe" | "jasa" | "umum";

export const RECEIPT_STYLES: {
  id: ReceiptStyle;
  label: string;
  hint: string;
}[] = [
  { id: "toko", label: "Toko / retail", hint: "Sembako, fashion, elektronik, minimarket" },
  { id: "cafe", label: "Cafe / restoran", hint: "Kafe, warung makan, bakery, F&B" },
  { id: "jasa", label: "Jasa", hint: "Salon, bengkel, laundry, konsultan" },
  { id: "umum", label: "Umum", hint: "Netral — cocok semua jenis usaha" },
];

export type ReceiptCopy = {
  tagline: string;
  footerNote: string;
  qtyUnit: string;
  showTable: boolean;
};

const COPY: Record<ReceiptStyle, ReceiptCopy> = {
  toko: {
    tagline: "Struk penjualan",
    footerNote: "Barang yang sudah dibeli tidak dapat dikembalikan.\nSimpan struk ini sebagai bukti.",
    qtyUnit: "pcs",
    showTable: false,
  },
  cafe: {
    tagline: "Struk cafe & restoran",
    footerNote: "Terima kasih sudah berkunjung.\nSemoga puas — sampai jumpa lagi.",
    qtyUnit: "porsi",
    showTable: true,
  },
  jasa: {
    tagline: "Bukti pembayaran jasa",
    footerNote: "Terima kasih atas kepercayaan Anda.\nSimpan struk ini sebagai bukti transaksi.",
    qtyUnit: "item",
    showTable: false,
  },
  umum: {
    tagline: "Bukti transaksi",
    footerNote: "Terima kasih.\nSimpan struk ini sebagai bukti.",
    qtyUnit: "item",
    showTable: false,
  },
};

export function normalizeReceiptStyle(v: unknown): ReceiptStyle {
  const s = String(v || "").toLowerCase();
  if (s === "toko" || s === "retail" || s === "shop") return "toko";
  if (s === "cafe" || s === "fnb" || s === "kuliner" || s === "restoran" || s === "restaurant") return "cafe";
  if (s === "jasa" || s === "service" || s === "bengkel") return "jasa";
  if (s === "umum" || s === "general") return "umum";
  return "toko";
}

/** Suggest receipt style from Gercep business.type when user belum set. */
export function receiptStyleFromBizType(type: string | null | undefined): ReceiptStyle {
  const t = String(type || "").toLowerCase();
  if (["kuliner", "fnb", "f&b", "food", "restoran", "warung"].includes(t)) return "cafe";
  if (["jasa", "service", "bengkel"].includes(t)) return "jasa";
  if (["retail", "toko", "shop", "olshop", "wholesale", "fashion"].includes(t)) return "toko";
  return "umum";
}

export function getReceiptCopy(
  style: ReceiptStyle,
  customNote?: string | null,
): ReceiptCopy {
  const base = COPY[style] || COPY.toko;
  const note = (customNote || "").trim();
  return note ? { ...base, footerNote: note } : base;
}
