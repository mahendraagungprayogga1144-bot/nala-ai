"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Check, X, Zap, Crown, Building2, Sparkles,
  ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react";
import { PAYMENT_WA } from "@/lib/payment/config";

function fmtRp(n: number) { return "Rp" + n.toLocaleString("id-ID"); }

const PLANS = [
  {
    id: "gratis",
    name: "Gratis",
    tagline: "Cocok untuk: Coba-coba dulu",
    priceMonthly: 0,
    priceYearly: 0,
    icon: Zap,
    color: "#8B8AA0",
    cta: "Mulai Gratis",
    ctaHref: "/signup",
    popular: false,
    features: [
      { text: "1 bisnis", ok: true },
      { text: "Keuangan basic (input manual)", ok: true },
      { text: "Dashboard Owner basic (tanpa grafik)", ok: true },
      { text: "Inventory", ok: false },
      { text: "Kasir", ok: false },
      { text: "AI features", ok: false },
      { text: "Marketplace Center", ok: false },
      { text: "Export Excel/PDF", ok: false },
      { text: "Produksi/HPP", ok: false },
    ],
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "Cocok untuk: UMKM kecil, warung, toko rumahan",
    priceMonthly: 40_000,
    priceYearly: 400_000,
    icon: Sparkles,
    color: "#38BDF8",
    cta: "Pilih Starter",
    ctaHref: "/signup?plan=starter",
    popular: false,
    features: [
      { text: "2 bisnis", ok: true },
      { text: "Inventory max 50 produk", ok: true },
      { text: "Kasir max 100 transaksi/bulan", ok: true },
      { text: "Keuangan Bisnis + Pribadi lengkap", ok: true },
      { text: "Produksi + HPP otomatis", ok: true },
      { text: "Export Excel/PDF", ok: true },
      { text: "AI features", ok: false },
      { text: "Marketplace Center", ok: false },
      { text: "Pajak NPWP", ok: false },
      { text: "CRM Pelanggan", ok: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Cocok untuk: UMKM aktif, online seller, reseller",
    priceMonthly: 75_000,
    priceYearly: 750_000,
    icon: Crown,
    color: "#2DD4BF",
    cta: "Coba 7 Hari Gratis",
    ctaHref: "/signup?plan=pro",
    popular: true,
    features: [
      { text: "5 bisnis", ok: true },
      { text: "Inventory max 500 produk", ok: true },
      { text: "Kasir max 500 transaksi/bulan", ok: true },
      { text: "Semua fitur Starter", ok: true },
      { text: "Marketplace Center (Shopee/TikTok/Tokopedia)", ok: true },
      { text: "AI Kasir universal", ok: true },
      { text: "Pajak NPWP Center", ok: true },
      { text: "Smart Profit Calculator", ok: true },
      { text: "CRM Pelanggan", ok: true },
      { text: "AI Marketing", ok: true },
      { text: "Insight AI di Dashboard", ok: true },
      { text: "WhatsApp notifikasi stok", ok: true },
      { text: "Priority support", ok: true },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Cocok untuk: Perusahaan, distributor, chain toko",
    priceMonthly: 150_000,
    priceYearly: 1_500_000,
    icon: Building2,
    color: "#A78BFA",
    cta: "Hubungi Kami",
    ctaHref: `https://wa.me/${PAYMENT_WA}`,
    popular: false,
    features: [
      { text: "Unlimited bisnis", ok: true },
      { text: "Inventory unlimited", ok: true },
      { text: "Kasir unlimited", ok: true },
      { text: "Semua fitur Pro", ok: true },
      { text: "Multi user hingga 10 akun", ok: true },
      { text: "API access", ok: true },
      { text: "White label", ok: true },
      { text: "Custom onboarding", ok: true },
      { text: "Dedicated support", ok: true },
      { text: "SLA 99.9% uptime", ok: true },
    ],
  },
];

const COMPARISON_ROWS: { label: string; values: (string | boolean)[] }[] = [
  { label: "Jumlah bisnis", values: ["1", "2", "5", "Unlimited"] },
  { label: "Produk inventory", values: [false, "50", "500", "Unlimited"] },
  { label: "Transaksi kasir/bulan", values: [false, "100", "500", "Unlimited"] },
  { label: "Keuangan Pribadi", values: [true, true, true, true] },
  { label: "Keuangan Bisnis", values: ["Basic", true, true, true] },
  { label: "Produksi / HPP", values: [false, true, true, true] },
  { label: "Export Excel / PDF", values: [false, true, true, true] },
  { label: "Marketplace Center", values: [false, false, true, true] },
  { label: "AI Kasir Universal", values: [false, false, true, true] },
  { label: "Pajak NPWP Center", values: [false, false, true, true] },
  { label: "CRM Pelanggan", values: [false, false, true, true] },
  { label: "AI Marketing", values: [false, false, true, true] },
  { label: "Insight AI Dashboard", values: [false, false, true, true] },
  { label: "WhatsApp Notifikasi", values: [false, false, true, true] },
  { label: "Multi user", values: [false, false, false, "10 akun"] },
  { label: "API access", values: [false, false, false, true] },
  { label: "White label", values: [false, false, false, true] },
  { label: "Priority / Dedicated support", values: [false, false, true, true] },
];

const FAQS = [
  { q: "Apakah ada kontrak?", a: "Tidak, semua paket bulanan dan bisa cancel kapan saja tanpa penalti." },
  { q: "Cara upgrade atau downgrade?", a: "Langsung dari dashboard, klik Upgrade dan pilih paket baru. Perubahan berlaku langsung." },
  { q: "Data saya aman?", a: "Ya, semua data terenkripsi dengan Supabase (PostgreSQL) dan hanya kamu yang bisa akses." },
  { q: "Apakah ada refund?", a: "Ya, garansi uang kembali 7 hari tanpa pertanyaan untuk semua paket berbayar." },
];

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <main className="min-h-screen text-[#F2F1F8] overflow-x-hidden" style={{ background: "#070711", fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06]" style={{ background: "rgba(7,7,17,.85)", backdropFilter: "blur(20px)" }}>
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <img src="/logo-gercep.png" alt="Gercep AI" className="h-8 w-8 rounded-lg object-cover" />
            <span>Gercep<span className="bg-gradient-to-r from-[#2DD4BF] to-[#8B5CF6] bg-clip-text text-transparent">AI</span></span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <Link href="/" className="hidden text-sm text-[#8B8AA0] hover:text-[#F0EFF8] transition-colors sm:block">Fitur</Link>
            <Link href="/pricing" className="hidden text-sm text-[#2DD4BF] font-medium sm:block">Harga</Link>
            <Link href="/login" className="text-sm text-[#8B8AA0] hover:text-[#F0EFF8] transition-colors">Masuk</Link>
            <Link href="/signup" className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}>
              Daftar
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-10 px-5 text-center">
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-15 blur-[120px]"
          style={{ background: "radial-gradient(circle, #2DD4BF, #8B5CF6, transparent)" }} />
        <h1 className="relative mx-auto max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">
          Pilih Paket yang Tepat untuk{" "}
          <span className="bg-gradient-to-r from-[#2DD4BF] to-[#8B5CF6] bg-clip-text text-transparent">Bisnismu</span>
        </h1>
        <p className="relative mx-auto mt-4 max-w-lg text-sm text-[#8B8AA0] sm:text-base">
          Mulai gratis, upgrade kapan saja. Tidak ada biaya tersembunyi.
        </p>

        {/* Toggle */}
        <div className="relative mt-8 inline-flex items-center gap-3 rounded-full border border-white/[0.08] p-1.5" style={{ background: "#0D0D1A" }}>
          <button type="button" onClick={() => setYearly(false)}
            className={"rounded-full px-5 py-2 text-sm font-medium transition-all " +
              (!yearly ? "bg-[#2DD4BF]/15 text-[#2DD4BF]" : "text-[#5A5B7A]")}>
            Bulanan
          </button>
          <button type="button" onClick={() => setYearly(true)}
            className={"rounded-full px-5 py-2 text-sm font-medium transition-all " +
              (yearly ? "bg-[#2DD4BF]/15 text-[#2DD4BF]" : "text-[#5A5B7A]")}>
            Tahunan
          </button>
          {yearly && (
            <span className="absolute -top-2.5 -right-2 rounded-full px-2 py-0.5 text-[9px] font-bold"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}>
              Hemat 2 Bulan
            </span>
          )}
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="mx-auto max-w-[1200px] px-5 pb-16">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map(plan => {
            const price = yearly ? plan.priceYearly : plan.priceMonthly;
            const perMonth = yearly && plan.priceYearly > 0 ? Math.round(plan.priceYearly / 12) : plan.priceMonthly;
            const isExternal = plan.ctaHref.startsWith("http");

            return (
              <div key={plan.id} className="relative flex flex-col rounded-2xl border overflow-hidden"
                style={{
                  borderColor: plan.popular ? "transparent" : "rgba(255,255,255,.06)",
                  background: "#0D0D1A",
                  ...(plan.popular ? {
                    borderImage: "linear-gradient(135deg, #2DD4BF, #8B5CF6) 1",
                  } : {}),
                }}>
                {plan.popular && (
                  <>
                    <div className="absolute inset-0 rounded-2xl" style={{
                      padding: "1.5px",
                      background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)",
                      WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                      WebkitMaskComposite: "xor",
                      maskComposite: "exclude",
                      borderRadius: "1rem",
                      pointerEvents: "none",
                    }} />
                    <div className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold"
                      style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}>
                      <Crown size={12} /> PALING POPULER
                    </div>
                  </>
                )}

                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  {/* Header */}
                  <div className="mb-4 flex items-center gap-2">
                    <plan.icon size={18} style={{ color: plan.color }} />
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                  </div>
                  <p className="mb-4 text-[11px] text-[#5A5B7A]">{plan.tagline}</p>

                  {/* Price */}
                  <div className="mb-5">
                    {price === 0 ? (
                      <p className="text-3xl font-bold" style={{ color: plan.color, fontFamily: "'JetBrains Mono', monospace" }}>Rp0</p>
                    ) : (
                      <>
                        <p className="text-3xl font-bold" style={{ color: plan.color, fontFamily: "'JetBrains Mono', monospace" }}>
                          {fmtRp(price)}
                        </p>
                        <p className="mt-0.5 text-xs text-[#5A5B7A]">
                          {yearly ? `/tahun (${fmtRp(perMonth)}/bulan)` : "/bulan"}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Features */}
                  <div className="mb-6 flex-1 space-y-2">
                    {plan.features.map(f => (
                      <div key={f.text} className="flex items-start gap-2">
                        {f.ok ? (
                          <Check size={14} className="mt-0.5 flex-shrink-0 text-[#2DD4BF]" />
                        ) : (
                          <X size={14} className="mt-0.5 flex-shrink-0 text-[#3A3B52]" />
                        )}
                        <span className={"text-xs " + (f.ok ? "text-[#C4C3D4]" : "text-[#3A3B52]")}>{f.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  {isExternal ? (
                    <a href={plan.ctaHref} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-opacity hover:opacity-90"
                      style={plan.popular
                        ? { background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }
                        : { border: `1px solid ${plan.color}44`, color: plan.color, background: `${plan.color}11` }}>
                      {plan.cta} <ArrowRight size={14} />
                    </a>
                  ) : (
                    <Link href={plan.ctaHref}
                      className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-opacity hover:opacity-90"
                      style={plan.popular
                        ? { background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }
                        : { border: `1px solid ${plan.color}44`, color: plan.color, background: `${plan.color}11` }}>
                      {plan.cta} <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="mx-auto max-w-[1200px] px-5 pb-16">
        <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">
          Bandingkan Semua <span className="bg-gradient-to-r from-[#2DD4BF] to-[#8B5CF6] bg-clip-text text-transparent">Fitur</span>
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]" style={{ background: "#0D0D1A" }}>
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="p-4 text-left text-xs font-semibold text-[#8B8AA0] uppercase tracking-wide">Fitur</th>
                {PLANS.map(p => (
                  <th key={p.id} className="p-4 text-center">
                    <span className="text-xs font-bold" style={{ color: p.color }}>{p.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr key={row.label} className={i < COMPARISON_ROWS.length - 1 ? "border-b border-white/[0.04]" : ""}>
                  <td className="px-4 py-3 text-xs text-[#8B8AA0]">{row.label}</td>
                  {row.values.map((val, j) => (
                    <td key={j} className="px-4 py-3 text-center">
                      {val === true ? (
                        <Check size={16} className="mx-auto text-[#2DD4BF]" />
                      ) : val === false ? (
                        <X size={16} className="mx-auto text-[#2A2B3D]" />
                      ) : (
                        <span className="text-xs font-medium text-[#C4C3D4]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{val}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[700px] px-5 pb-20">
        <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">
          Pertanyaan <span className="bg-gradient-to-r from-[#2DD4BF] to-[#8B5CF6] bg-clip-text text-transparent">Umum</span>
        </h2>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] overflow-hidden" style={{ background: "#0D0D1A" }}>
              <button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-[#F0EFF8]">
                {faq.q}
                {openFaq === i ? <ChevronUp size={16} className="text-[#2DD4BF]" /> : <ChevronDown size={16} className="text-[#5A5B7A]" />}
              </button>
              {openFaq === i && (
                <div className="border-t border-white/[0.06] px-5 py-4 text-xs text-[#8B8AA0] leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA bottom */}
      <section className="border-t border-white/[0.06] py-16 px-5 text-center" style={{ background: "#0A0A14" }}>
        <h2 className="mb-3 text-2xl font-bold sm:text-3xl">Siap Mulai?</h2>
        <p className="mb-6 text-sm text-[#8B8AA0]">Daftar gratis sekarang dan rasakan semua fitur.</p>
        <Link href="/signup"
          className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}>
          Mulai Gratis Sekarang <ArrowRight size={16} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 px-5" style={{ background: "#070711" }}>
        <div className="mx-auto max-w-[1200px] flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-xs text-[#3A3B52]">&copy; 2026 PT Henima Collection Indonesia. All rights reserved.</p>
          <div className="flex gap-6 text-xs text-[#5A5B7A]">
            <a href="/terms" className="hover:text-[#8B8AA0] transition-colors">Syarat & Ketentuan</a>
            <a href="/privacy" className="hover:text-[#8B8AA0] transition-colors">Privasi</a>
            <a href="/kebijakan-data" className="hover:text-[#8B8AA0] transition-colors">Kebijakan Data</a>
            <a href={`https://wa.me/${PAYMENT_WA}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#8B8AA0] transition-colors">Kontak</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
