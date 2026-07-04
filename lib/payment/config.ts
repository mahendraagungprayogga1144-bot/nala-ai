// ═══ KONFIGURASI PEMBAYARAN MANUAL ═══
// Ganti nomor WA dan rekening di bawah dengan data asli sebelum jualan.

export const PAYMENT_WA = "6281234567890"; // TODO: ganti nomor WhatsApp admin

export const BANK_ACCOUNTS = [
  { bank: "BCA", number: "1234567890", holder: "PT Henima Collection Indonesia" }, // TODO: ganti
  { bank: "DANA / QRIS", number: "081234567890", holder: "Gercep AI" }, // TODO: ganti
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

export function buildWaMessage(opts: { name: string; email: string; plan: string; amount: number; invoice: string }) {
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
  return `https://wa.me/${PAYMENT_WA}?text=${encodeURIComponent(lines.join("\n"))}`;
}
