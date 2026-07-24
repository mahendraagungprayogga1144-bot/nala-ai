// ═══ KONFIGURASI PEMBAYARAN MANUAL ═══
// Placeholder ONLY for local/dev. Production upgrade UI must refuse these.

export const PAYMENT_WA = "6281234567890"; // placeholder — block in upgrade UI

export const PLACEHOLDER_WA = "6281234567890";
export const PLACEHOLDER_BANK_NUMBERS = new Set(["1234567890", "081234567890"]);

export function isPlaceholderPaymentConfig(wa: string, banks: BankAccount[]) {
  const waDigits = (wa || "").replace(/\D/g, "");
  if (!waDigits || waDigits === PLACEHOLDER_WA || waDigits === "6281234567890") return true;
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

export function buildWaMessage(opts: {
  name: string;
  email: string;
  plan: string;
  amount: number;
  invoice: string;
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
  const wa = (opts.wa || PAYMENT_WA).replace(/\D/g, "") || PAYMENT_WA;
  return `https://wa.me/${wa}?text=${encodeURIComponent(lines.join("\n"))}`;
}
