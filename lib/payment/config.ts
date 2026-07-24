// ═══ KONFIGURASI PEMBAYARAN MANUAL ═══
// Placeholder ONLY for local/dev. Production upgrade UI must refuse these.

export const PAYMENT_WA = "6281234567890"; // placeholder — block in upgrade UI

export const PLACEHOLDER_WA = "6281234567890";
export const PLACEHOLDER_BANK_NUMBERS = new Set(["1234567890", "081234567890"]);

/**
 * Digits for wa.me / api.whatsapp.com `phone=` — must be international, no leading 0.
 * Admin often saves local ID numbers (`0822…`); WA rejects those (“tautan tidak dapat dibuka”).
 */
export function toWaMeDigits(wa: string) {
  let d = (wa || "").replace(/\D/g, "");
  if (!d) return "";
  // 00<cc>… → drop international trunk prefix
  if (d.startsWith("00")) d = d.slice(2);
  // Local Indonesia mobile: 08xxxx → 628xxxx
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  // Bare mobile without trunk/country (8xxxx, length typical for ID)
  if (/^8[1-9]\d{7,11}$/.test(d)) d = `62${d}`;
  return d;
}

export function isPlaceholderWa(wa: string) {
  const waDigits = toWaMeDigits(wa);
  return !waDigits || waDigits === PLACEHOLDER_WA || waDigits === "6281234567890";
}

export function isPlaceholderPaymentConfig(wa: string, banks: BankAccount[]) {
  if (isPlaceholderWa(wa)) return true;
  if (!banks.length) return true;
  const allFake = banks.every(
    (b) => !b.number?.trim() || PLACEHOLDER_BANK_NUMBERS.has(b.number.replace(/\D/g, "")),
  );
  return allFake;
}

export type BankAccount = {
  bank: string;
  number: string;
  holder: string;
};

export const BANK_ACCOUNTS: BankAccount[] = [
  { bank: "BCA", number: "1234567890", holder: "PT Henima Collection Indonesia" },
  { bank: "DANA / QRIS", number: "081234567890", holder: "Gercep AI" },
];

export type PlanKey = "starter" | "pro" | "enterprise";

export const UPGRADE_PLANS: Record<PlanKey, {
  name: string;
  price: number;
  color: string;
  features: string[];
  popular?: boolean;
}> = {
  starter: {
    name: "Starter",
    price: 40_000,
    color: "#38BDF8",
    features: ["2 bisnis", "Inventory 50 produk", "Export Excel/PDF", "Keuangan lengkap"],
  },
  pro: {
    name: "Pro",
    price: 75_000,
    color: "#2DD4BF",
    popular: true,
    features: ["5 bisnis", "AI Kasir universal", "Marketplace Center", "Pajak NPWP", "Semua fitur AI"],
  },
  enterprise: {
    name: "Enterprise",
    price: 150_000,
    color: "#A78BFA",
    features: ["Unlimited bisnis", "API access", "Dedicated support", "Semua fitur Pro"],
  },
};

export function fmtRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

/** Build wa.me URL. Placeholder/missing WA → chooser (`wa.me/?text=`) so we never open the fake number. */
export function waMeUrl(text: string, wa?: string) {
  const encoded = encodeURIComponent(text);
  const digits = toWaMeDigits(wa || "");
  if (isPlaceholderWa(digits)) return `https://wa.me/?text=${encoded}`;
  return `https://wa.me/${digits}?text=${encoded}`;
}

export function buildWaMessage(opts: {
  name: string;
  email: string;
  plan: string;
  amount: number;
  invoice: string;
  invoiceUrl?: string;
  wa?: string;
}) {
  const lines = [
    "Halo Admin Gercep AI! Saya mau upgrade paket.",
    "",
    `Nama: ${opts.name}`,
    `Email: ${opts.email}`,
    `Paket: ${opts.plan.toUpperCase()} — ${fmtRupiah(opts.amount)}/bulan`,
    `Invoice: ${opts.invoice}`,
    "",
    "Saya sudah transfer, berikut bukti transfernya. Mohon di-ACC ya, terima kasih!",
  ];
  if (opts.invoiceUrl) {
    lines.push("", "Invoice:", opts.invoiceUrl);
  }
  return waMeUrl(lines.join("\n"), opts.wa);
}

/** Share paid/pending invoice link via WhatsApp (after payment recorded). */
export function buildInvoiceShareWaMessage(opts: {
  name: string;
  email: string;
  plan: string;
  amount: number;
  invoice: string;
  status: string;
  invoiceUrl: string;
  wa?: string;
}) {
  const statusLabel =
    opts.status === "paid" ? "LUNAS" : opts.status === "pending" ? "MENUNGGU KONFIRMASI" : opts.status.toUpperCase();
  // Keep a single bare HTTPS URL on its own line — WA link detection is unreliable mid-sentence.
  const lines = [
    "Halo! Invoice langganan Gercep AI:",
    "",
    `Nama: ${opts.name}`,
    `Email: ${opts.email}`,
    `Paket: ${opts.plan.toUpperCase()} — ${fmtRupiah(opts.amount)}/bulan`,
    `Invoice: ${opts.invoice}`,
    `Status: ${statusLabel}`,
    "",
    "Buka invoice:",
    opts.invoiceUrl,
  ];
  return waMeUrl(lines.join("\n"), opts.wa);
}
