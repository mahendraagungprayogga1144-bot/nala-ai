import { isValidPhoneId, normalizePhoneId } from "../phone";
import { DEFAULT_HENIMA_PRODUCTS, type PaymentMethod, type ProductRow, type SaleLine, normalizePaymentMethod } from "../types";

export type ParsedSaleChat = {
  looksLikeSale: boolean;
  phone: string | null;
  customerName: string | null;
  quantity: number | null;
  unitPrice: number | null;
  discount: number | null;
  discountPercent: number | null;
  productId: string | null;
  productName: string | null;
  paymentMethod: PaymentMethod | null;
  matchedProducts: ProductRow[];
  isPack: boolean;
};

export type OpsIntent =
  | { type: "rekap"; period: "today" | "this_week" | "this_month" }
  | { type: "pdf"; period: "today" | "this_week" | "this_month" }
  | { type: "nota"; query?: string }
  | { type: "riwayat" }
  | { type: "target" }
  | { type: "help" }
  | { type: "none" };

function periodFromText(t: string): "today" | "this_week" | "this_month" {
  if (/\b(minggu|mingguan|weekly|week)\b/.test(t)) return "this_week";
  if (/\b(bulan|bulanan|bln|monthly|month)\b/.test(t)) return "this_month";
  return "today";
}

export function parseOpsIntent(text: string): OpsIntent {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return { type: "none" };
  if (/^(help|bantuan|menu|perintah|\?)$/.test(t)) return { type: "help" };
  if (/\b(nota|invoice|kwitansi|struk)\b/.test(t)) {
    const query = extractNotaQuery(t);
    return query ? { type: "nota", query } : { type: "nota" };
  }
  if (/\b(pdf|laporan)\b/.test(t) || /\brekap(an)?\s+pdf\b/.test(t)) {
    return { type: "pdf", period: periodFromText(t) };
  }
  if (/\b(rekap|rekapan|ringkasan)\b/.test(t)) {
    const period = periodFromText(t);
    if (period === "this_month") return { type: "pdf", period };
    return { type: "rekap", period };
  }
  if (/\b(riwayat|histori|history)\b/.test(t)) return { type: "riwayat" };
  if (/(target|pencapaian|tercapai)/.test(t)) return { type: "target" };
  return { type: "none" };
}

/** "nota untuk regan" / "nota dimas" → "regan" / "dimas". Bare "nota" → undefined. */
export function extractNotaQuery(text: string): string | undefined {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  const m = t.match(/^(?:\/)?(?:nota|invoice|kwitansi|struk)(?:\s+(?:untuk|buat|kepada|ke|atas\s+nama|a\/n|an))?\s*(.*)$/);
  if (!m) {
    const anywhere = t.match(/\b(?:nota|invoice|kwitansi|struk)(?:\s+(?:untuk|buat|kepada|ke|atas\s+nama|a\/n|an))?\s+([a-z0-9][\w .'-]{0,40})$/);
    const q = anywhere?.[1]?.trim();
    return q || undefined;
  }
  let q = (m[1] || "").trim();
  q = q.replace(/^(?:untuk|buat|kepada|ke|atas\s+nama|a\/n|an)\s+/i, "").trim();
  if (!q || /^(customer|pelanggan)$/i.test(q)) return undefined;
  return q.slice(0, 60);
}

const SALE_HINT =
  /\b(laku|terjual|jual|closing|order|omzet|pcs|botol|paket|pack|harga|atas nama|a\/n|no\.?\s*(telp|telfon|telfone|telepon|hp|wa))\b/i;

export function parseIdrAmountToken(num: string, suffix?: string | null): number | null {
  const s = (suffix || "").toLowerCase();
  const raw = num.trim();
  if (s === "rb" || s === "ribu" || s === "k") {
    const n = Number(raw.replace(",", "."));
    if (!(n > 0)) return null;
    return Math.round(n * 1000);
  }
  if (s === "jt" || s === "juta") {
    const n = Number(raw.replace(",", "."));
    if (!(n > 0)) return null;
    return Math.round(n * 1_000_000);
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return n > 0 ? n : null;
}

export function parseSalesChat(text: string, products: ProductRow[]): ParsedSaleChat {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  const empty: ParsedSaleChat = {
    looksLikeSale: false,
    phone: null,
    customerName: null,
    quantity: null,
    unitPrice: null,
    discount: null,
    discountPercent: null,
    productId: null,
    productName: null,
    paymentMethod: null,
    matchedProducts: [],
    isPack: false,
  };
  if (!raw) return empty;

  const phone = extractPhone(raw);
  const disc = extractDiscount(lower);
  const unitPrice = extractPrice(stripDiscountClause(lower));
  const quantity = extractQty(lower);
  const customerName = extractName(raw);
  const matchedProducts = matchAllProducts(lower, products);
  const product = matchedProducts[0] || null;
  const paymentMethod = extractPay(lower);
  const isPack = looksLikePack(lower) || matchedProducts.length > 1;

  const looksLikeSale = Boolean(
    SALE_HINT.test(lower) && (phone || unitPrice || quantity || customerName),
  );

  return {
    looksLikeSale,
    phone,
    customerName,
    quantity,
    unitPrice,
    discount: disc.amount,
    discountPercent: disc.percent,
    productId: product?.id || null,
    productName: product?.name || null,
    paymentMethod,
    matchedProducts,
    isPack,
  };
}

export function looksLikePack(lower: string) {
  return /\b(paket|pack|bundel|bundle|new member|member baru|keduanya)\b/.test(lower);
}

export function matchAllProducts(lower: string, products: ProductRow[]): ProductRow[] {
  const hits: ProductRow[] = [];
  for (const p of products) {
    const name = (p.name || "").trim().toLowerCase();
    if (name.length < 2) continue;
    if (lower.includes(name) && !hits.some((h) => h.id === p.id)) hits.push(p);
  }
  hits.sort((a, b) => b.name.length - a.name.length);
  return hits;
}

export function defaultPackProducts(products: ProductRow[]): ProductRow[] {
  const wanted = new Set(DEFAULT_HENIMA_PRODUCTS.map((d) => d.name.toLowerCase()));
  const named = products.filter((p) => wanted.has((p.name || "").trim().toLowerCase()));
  if (named.length >= 2) return named.slice(0, 2);
  return products.slice(0, 2);
}

export function splitTotalAcrossLines(total: number, quantities: number[]): number[] {
  const wsum = quantities.reduce((a, b) => a + b, 0);
  if (!wsum) return quantities.map(() => 0);
  const unitPrices: number[] = [];
  let allocated = 0;
  for (let i = 0; i < quantities.length; i++) {
    const qty = quantities[i];
    if (i === quantities.length - 1) {
      const rest = Math.round(total - allocated);
      unitPrices.push(qty > 0 ? Math.round(rest / qty) : 0);
    } else {
      const part = Math.round(total * (qty / wsum));
      allocated += part;
      unitPrices.push(qty > 0 ? Math.round(part / qty) : 0);
    }
  }
  return unitPrices;
}

export function buildPackLines(matched: ProductRow[], packQty: number, total: number): SaleLine[] {
  const qty = packQty > 0 ? packQty : 1;
  const quantities = matched.map(() => qty);
  const unitPrices = splitTotalAcrossLines(total, quantities);
  return matched.map((p, i) => ({
    productId: p.id,
    productName: p.name,
    quantity: qty,
    unitPrice: unitPrices[i],
  }));
}

/** "afternoon 3 the distance 2" → qty per SKU. */
export function extractProductQuantities(lower: string, products: ProductRow[]): Map<string, number> {
  const map = new Map<string, number>();
  const sorted = [...products].sort((a, b) => (b.name || "").length - (a.name || "").length);
  for (const p of sorted) {
    const name = (p.name || "").trim().toLowerCase();
    if (name.length < 2) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const after = lower.match(new RegExp(`\\b${escaped}\\s+(\\d+)\\b`));
    const before = lower.match(new RegExp(`\\b(\\d+)\\s+${escaped}\\b`));
    const n = Number(after?.[1] || before?.[1] || 0);
    if (n > 0) map.set(p.id, n);
  }
  return map;
}

export function buildQtyLines(matched: ProductRow[], qtyByProduct: Map<string, number>, total: number): SaleLine[] {
  const quantities = matched.map((p) => qtyByProduct.get(p.id) || 1);
  const unitPrices = splitTotalAcrossLines(total, quantities);
  return matched.map((p, i) => ({
    productId: p.id,
    productName: p.name,
    quantity: quantities[i],
    unitPrice: unitPrices[i],
  }));
}

export function resolvePackProducts(matched: ProductRow[], catalog: ProductRow[]): ProductRow[] {
  if (matched.length >= 2) return matched;
  return defaultPackProducts(catalog);
}

function extractPhone(text: string): string | null {
  const labeled = text.match(
    /(?:no\.?\s*)?(?:telfon(?:e)?|telepon|telp(?:on|one)?|hp|wa|whatsapp)\s*[:.\-]*\s*(\+?[\d\s\-()]{8,20})/i,
  );
  const candidates = [
    labeled?.[1],
    ...Array.from(text.matchAll(/(\+?62[\d\s\-()]{8,16}|0[8][\d\s\-()]{7,14})/g)).map((m) => m[1]),
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    const n = normalizePhoneId(c);
    if (isValidPhoneId(n)) return n;
  }
  return null;
}

function stripDiscountClause(lower: string) {
  return lower.replace(/\b(?:diskon|disc|potongan)\s*(?:rp|:)?\s*[\d.,]+\s*(%|persen|rb|ribu|k)?/g, " ");
}

function extractDiscount(lower: string): { amount: number | null; percent: number | null } {
  const m = lower.match(/\b(?:diskon|disc|potongan)\s*(?:rp|:)?\s*([\d.,]+)\s*(%|persen|rb|ribu|k)?/);
  if (!m) return { amount: null, percent: null };
  const suffix = (m[2] || "").toLowerCase();
  if (suffix === "%" || suffix === "persen") {
    const n = Number(String(m[1]).replace(",", "."));
    if (!(n > 0) || n > 100) return { amount: null, percent: null };
    return { amount: null, percent: n };
  }
  const amount = parseIdrAmountToken(m[1], suffix || null);
  if (amount && amount < 1000 && !suffix) {
    return { amount: null, percent: amount <= 100 ? amount : null };
  }
  return { amount, percent: null };
}

function extractPrice(lower: string): number | null {
  const labeled = lower.match(/harga\s*(?:jual)?\s*(?:rp|:)?\s*([\d.,]+)\s*(rb|ribu|k|jt|juta)?/);
  if (labeled) return parseIdrAmountToken(labeled[1], labeled[2]);
  const withSuffix = lower.match(/([\d.,]+)\s*(rb|ribu|k)\b/);
  if (withSuffix) return parseIdrAmountToken(withSuffix[1], withSuffix[2]);
  const rp = lower.match(/rp\s*([\d.]+)/);
  if (rp) return parseIdrAmountToken(rp[1], null);
  return null;
}

function extractQty(lower: string): number | null {
  const pack = lower.match(/(\d+)\s*(?:paket|pack|bundel|bundle)\b/);
  if (pack) {
    const n = Number(pack[1]);
    return n > 0 ? n : null;
  }
  const labeled = lower.match(/(?:laku|terjual|jual|qty|jumlah|closing)\D{0,20}?(\d+)/);
  if (labeled) {
    const n = Number(labeled[1]);
    return n > 0 ? n : null;
  }
  const unit = lower.match(/(\d+)\s*(?:pcs|botol|buah|pcs\b)/);
  if (unit) {
    const n = Number(unit[1]);
    return n > 0 ? n : null;
  }
  return null;
}

function extractName(text: string): string | null {
  const m = text.match(/(?:atas\s+nama|a\/n|\bnama)\s+([A-Za-z][A-Za-z'.-]{1,40}(?:\s+[A-Za-z][A-Za-z'.-]{1,20}){0,3})/i);
  if (!m) return null;
  const stop = /^(no|telp|telfon|telfone|telepon|hp|wa|whatsapp|harga|laku|jual|tf|trf|qris|qr|cash|tunai|kontan|transfer|transef|lainnya)$/i;
  const parts = m[1].split(/\s+/).filter((p) => !stop.test(p));
  return cleanName(parts.join(" "));
}

function cleanName(s: string) {
  const n = s
    .replace(/\b(tf|trf|qris|qr|cash|tunai|kontan|transfer|transef|lainnya)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (n.length < 2) return null;
  if (/^(laku|terjual|jual|closing|order|omzet)\b/i.test(n)) return null;
  return n;
}

function extractPay(lower: string): PaymentMethod | null {
  return parsePaymentMethod(lower);
}

/** tf / transfer / qris / cash / tunai / lainnya */
export function parsePaymentMethod(text: string): PaymentMethod | null {
  return normalizePaymentMethod(text);
}
