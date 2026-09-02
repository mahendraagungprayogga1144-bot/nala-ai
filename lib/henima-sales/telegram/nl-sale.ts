import { namedMonthWindow, namedYearWindow, wibParts } from "../dates";
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

export type ReportPeriod = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "custom";

export type OpsIntent =
  | { type: "rekap"; period: ReportPeriod; from?: string; to?: string }
  | { type: "pdf"; period: ReportPeriod; from?: string; to?: string }
  | { type: "nota"; query?: string }
  | { type: "riwayat" }
  | { type: "target" }
  | { type: "help" }
  | { type: "none" };

const MONTH_ALIASES: { month: number; names: string[] }[] = [
  { month: 1, names: ["januari", "january", "jan"] },
  { month: 2, names: ["februari", "february", "feb"] },
  { month: 3, names: ["maret", "march", "mar"] },
  { month: 4, names: ["april", "apr"] },
  { month: 5, names: ["mei", "may"] },
  { month: 6, names: ["juni", "june", "jun"] },
  { month: 7, names: ["juli", "july", "jul"] },
  { month: 8, names: ["agustus", "august", "agu", "ags", "aug"] },
  { month: 9, names: ["september", "sept", "sep"] },
  { month: 10, names: ["oktober", "october", "okt", "oct"] },
  { month: 11, names: ["november", "nov"] },
  { month: 12, names: ["desember", "december", "des", "dec"] },
];

export function parseNamedMonth(text: string): { month: number; year?: number } | null {
  const t = text.toLowerCase();
  const yearM = t.match(/\b(20\d{2})\b/);
  const year = yearM ? Number(yearM[1]) : undefined;
  const aliases = MONTH_ALIASES.flatMap((row) => row.names.map((n) => ({ month: row.month, n }))).sort(
    (a, b) => b.n.length - a.n.length,
  );
  for (const { month, n } of aliases) {
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(t)) return { month, year };
  }
  const numbered = t.match(/\b(?:bulan|bln|month)\s+(\d{1,2})\b/);
  if (numbered) {
    const month = Number(numbered[1]);
    if (month >= 1 && month <= 12) return { month, year };
  }
  return null;
}

export function parseNamedYear(text: string): number | null {
  const t = text.toLowerCase();
  const yNow = Number(wibParts().year);
  if (/\b((tahun|year)\s+(lalu|kemarin|last|pasado)|last\s+year)\b/.test(t)) return yNow - 1;
  const explicit = t.match(/\b(20\d{2})\b/);
  if (explicit && !parseNamedMonth(t)) return Number(explicit[1]);
  if (/\b(setahun|tahunan|tahun\s+ini|this\s+year|yearly|annual|sepanjang\s+tahun)\b/.test(t)) return yNow;
  if (/\b(tahun|year)\b/.test(t) && !/\b(bulan|minggu|hari|month|week|day)\b/.test(t)) return yNow;
  return null;
}

export function periodFromText(t: string): { period: ReportPeriod; from?: string; to?: string } {
  const named = parseNamedMonth(t);
  if (named) {
    const win = namedMonthWindow(named.month, named.year);
    return { period: "custom", from: win.from, to: win.to };
  }
  const year = parseNamedYear(t);
  if (year != null) {
    const win = namedYearWindow(year);
    return { period: "custom", from: win.from, to: win.to };
  }
  if (/\b(kemarin|yesterday|ayer|hier)\b/.test(t)) return { period: "yesterday" };
  if (/\b((minggu|pekan|week)\s+(lalu|kemarin|last|pasado)|last\s+week)\b/.test(t)) return { period: "last_week" };
  if (/\b((bulan|month|bln)\s+(lalu|kemarin|last|pasado)|last\s+month)\b/.test(t)) return { period: "last_month" };
  if (/\b(minggu|mingguan|weekly|week|semaine|semana)\b/.test(t)) return { period: "this_week" };
  if (/\b(bulan|bulanan|bln|monthly|month|mois|mes)\b/.test(t)) return { period: "this_month" };
  return { period: "today" };
}

export function parseOpsIntent(text: string): OpsIntent {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return { type: "none" };
  if (/^(help|bantuan|menu|perintah|aide|ayuda|\?)$/.test(t)) return { type: "help" };
  if (/\b(nota|invoice|kwitansi|struk|receipt)\b/.test(t)) {
    const query = extractNotaQuery(t);
    return query ? { type: "nota", query } : { type: "nota" };
  }
  if (/\b(pdf|laporan|report)\b/.test(t) || /\brekap(an)?\s+pdf\b/.test(t)) {
    return { type: "pdf", ...periodFromText(t) };
  }
  if (/\b(rekap|rekapan|ringkasan|summary|recap)\b/.test(t)) {
    const parsed = periodFromText(t);
    if (parsed.period === "this_month" || parsed.period === "last_month" || parsed.period === "custom") {
      return { type: "pdf", ...parsed };
    }
    return { type: "rekap", ...parsed };
  }
  if (/\b(riwayat|histori|history|historial)\b/.test(t)) return { type: "riwayat" };
  if (/(target|pencapaian|tercapai|goal)/.test(t)) return { type: "target" };
  return { type: "none" };
}

/** "nota untuk regan" / "nota dimas" → "regan" / "dimas". Bare "nota" → undefined. */
export function extractNotaQuery(text: string): string | undefined {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  const m = t.match(/^(?:\/)?(?:nota|invoice|kwitansi|struk|receipt)(?:\s+(?:untuk|buat|kepada|ke|for|atas\s+nama|a\/n|an))?\s*(.*)$/);
  if (!m) {
    const anywhere = t.match(/\b(?:nota|invoice|kwitansi|struk|receipt)(?:\s+(?:untuk|buat|kepada|ke|for|atas\s+nama|a\/n|an))?\s+([a-z0-9][\w .'-]{0,40})$/);
    const q = anywhere?.[1]?.trim();
    return q || undefined;
  }
  let q = (m[1] || "").trim();
  q = q.replace(/^(?:untuk|buat|kepada|ke|for|atas\s+nama|a\/n|an)\s+/i, "").trim();
  if (!q || /^(customer|pelanggan)$/i.test(q)) return undefined;
  return q.slice(0, 60);
}

const SALE_HINT =
  /\b(laku|terjual|jual|closing|order|omzet|sold|sell|sale|bought|purchase|vendi|vendido|vendu|pcs|botol|bottles?|paket|pack|harga|price|precio|prix|preco|preis|atas nama|a\/n|no\.?\s*(telp|telfon|telfone|telepon|hp|wa|phone))\b/i;

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
    (matchedProducts.length > 0 && (phone || unitPrice || quantity || customerName)) ||
      (SALE_HINT.test(lower) && (phone || unitPrice || quantity || customerName)),
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
  return /\b(paket|pack|bundel|bundle|combo|set|new member|member baru|keduanya|both)\b/.test(lower);
}

/** "2 paket harga 250k" = total paket. "afternoon 3 harga 149rb" = harga satuan. */
export function hargaIsOrderTotal(text: string) {
  const t = text.toLowerCase();
  if (looksLikePack(t)) return true;
  return /\b(harga\s+total|total\s+harga|totalnya|seharga\s+total|total\s+price|price\s+total|grand\s+total)\b/.test(t);
}

export function matchAllProducts(lower: string, products: ProductRow[]): ProductRow[] {
  const hits: ProductRow[] = [];
  const add = (p: ProductRow) => {
    if (!hits.some((h) => h.id === p.id)) hits.push(p);
  };
  for (const p of products) {
    const name = (p.name || "").trim().toLowerCase();
    if (name.length < 2) continue;
    if (lower.includes(name)) add(p);
  }
  for (const p of products) {
    const words = (p.name || "")
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 4);
    for (const w of words) {
      const unique = products.filter((x) => (x.name || "").toLowerCase().includes(w)).length === 1;
      if (!unique) continue;
      const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`).test(lower)) add(p);
    }
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

function productNamePatterns(product: ProductRow, catalog: ProductRow[]): string[] {
  const name = (product.name || "").trim().toLowerCase();
  const out: string[] = [];
  const push = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (t.length < 2) return;
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!out.includes(escaped)) out.push(escaped);
  };
  if (name) push(name);
  for (const w of name.split(/\s+/).filter((x) => x.length >= 4)) {
    const unique = catalog.filter((x) => (x.name || "").toLowerCase().includes(w)).length === 1;
    if (unique) push(w);
  }
  return out;
}

/**
 * "afternoon 3 the distance 2" (nama lalu qty) vs "3 afternoon 2 the distance" (qty lalu nama).
 * Pilih pola yang lebih sering muncul supaya angka SKU berikutnya tidak ketarik.
 */
export function extractProductQuantities(lower: string, products: ProductRow[]): Map<string, number> {
  const hits: { id: string; after: number | null; before: number | null }[] = [];
  for (const p of products) {
    let after: number | null = null;
    let before: number | null = null;
    for (const escaped of productNamePatterns(p, products)) {
      const a = lower.match(new RegExp(`\\b${escaped}\\s+(\\d+)\\b`));
      const b = lower.match(new RegExp(`\\b(\\d+)\\s+${escaped}\\b`));
      if (after == null && a?.[1]) {
        const n = Number(a[1]);
        if (n > 0) after = n;
      }
      if (before == null && b?.[1]) {
        const n = Number(b[1]);
        if (n > 0) before = n;
      }
    }
    if (after || before) hits.push({ id: p.id, after, before });
  }
  const afterHits = hits.filter((h) => h.after != null).length;
  const beforeHits = hits.filter((h) => h.before != null).length;
  const preferBefore = beforeHits > afterHits;
  const map = new Map<string, number>();
  for (const h of hits) {
    const n = preferBefore ? h.before || h.after : h.after || h.before;
    if (n && n > 0) map.set(h.id, n);
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

export function buildUnitPriceLines(matched: ProductRow[], qtyByProduct: Map<string, number>, unitPrice: number): SaleLine[] {
  return matched.map((p) => ({
    productId: p.id,
    productName: p.name,
    quantity: qtyByProduct.get(p.id) || 1,
    unitPrice,
  }));
}

export function resolvePackProducts(matched: ProductRow[], catalog: ProductRow[]): ProductRow[] {
  if (matched.length >= 2) return matched;
  return defaultPackProducts(catalog);
}

function extractPhone(text: string): string | null {
  const labeled = text.match(
    /(?:no\.?\s*)?(?:telfon(?:e)?|telepon|telp(?:on|one)?|hp|wa|whatsapp|phone|number|nomor|nomer|tel)\s*[:.\-]*\s*(\+?[\d\s\-()]{8,20})/i,
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
  return lower.replace(/\b(?:diskon|disc|potongan|discount|promo|rebate|off)\s*(?:rp|:)?\s*[\d.,]+\s*(%|persen|percent|rb|ribu|k)?/g, " ");
}

function extractDiscount(lower: string): { amount: number | null; percent: number | null } {
  const m = lower.match(/\b(?:diskon|disc|potongan|discount|promo|rebate|off)\s*(?:rp|:)?\s*([\d.,]+)\s*(%|persen|percent|rb|ribu|k)?/);
  if (!m) return { amount: null, percent: null };
  const suffix = (m[2] || "").toLowerCase();
  if (suffix === "%" || suffix === "persen" || suffix === "percent") {
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
  const labeled = lower.match(
    /(?:harga(?:\s+jual|\s+satuan)?|price(?:\s+each)?|unit\s+price|precio|prix|pre[cç]o|preis|idr)\s*(?:rp|idr|:)?\s*([\d.,]+)\s*(rb|ribu|k|jt|juta)?/,
  );
  if (labeled) return parseIdrAmountToken(labeled[1], labeled[2]);
  const withSuffix = lower.match(/([\d.,]+)\s*(rb|ribu|k)\b/);
  if (withSuffix) return parseIdrAmountToken(withSuffix[1], withSuffix[2]);
  const rp = lower.match(/(?:rp|idr)\s*([\d.]+)/);
  if (rp) return parseIdrAmountToken(rp[1], null);
  return null;
}

function extractQty(lower: string): number | null {
  const pack = lower.match(/(\d+)\s*(?:paket|pack|bundel|bundle|combo|set)\b/);
  if (pack) {
    const n = Number(pack[1]);
    return n > 0 ? n : null;
  }
  const labeled = lower.match(
    /(?:laku|terjual|jual|qty|jumlah|closing|sold|sell|bought|quantity|vendi|vendido|vendu)\D{0,24}?(\d+)/,
  );
  if (labeled) {
    const n = Number(labeled[1]);
    return n > 0 ? n : null;
  }
  const unit = lower.match(/(\d+)\s*(?:pcs|botol|buah|bottles?|units?)\b/);
  if (unit) {
    const n = Number(unit[1]);
    return n > 0 ? n : null;
  }
  return null;
}

function extractName(text: string): string | null {
  const m = text.match(
    /(?:atas\s+nama|a\/n|\bnama|\bname|\bnombre|\bnome|\bcustomer|\bpembeli|\bkepada|\buntuk|\bfor|\bpara|\bpour)\s+([\p{L}][\p{L}'.-]{1,40}(?:\s+[\p{L}][\p{L}'.-]{1,20}){0,3})/iu,
  );
  if (!m) return null;
  const stop =
    /^(no|telp|telfon|telfone|telepon|hp|wa|whatsapp|phone|number|nomor|nomer|harga|price|laku|jual|sold|tf|trf|qris|qr|cash|tunai|kontan|transfer|transef|lainnya|other)$/i;
  const parts = m[1].split(/\s+/).filter((p) => !stop.test(p));
  return cleanName(parts.join(" "));
}

function cleanName(s: string) {
  const n = s
    .replace(/\b(tf|trf|qris|qr|cash|tunai|kontan|transfer|transef|lainnya|other|bank)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (n.length < 2) return null;
  if (/^(laku|terjual|jual|closing|order|omzet|sold|sell|sale)\b/i.test(n)) return null;
  return n;
}

function extractPay(lower: string): PaymentMethod | null {
  return parsePaymentMethod(lower);
}

/** tf / transfer / qris / cash / tunai / lainnya */
export function parsePaymentMethod(text: string): PaymentMethod | null {
  return normalizePaymentMethod(text);
}
