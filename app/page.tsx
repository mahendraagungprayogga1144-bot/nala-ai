"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Store,
  Bird,
  UtensilsCrossed,
  Factory,
  Briefcase,
  Truck,
  ShoppingBag,
  Heart,
  Leaf,
  Wrench,
  PenLine,
  Menu,
  X,
} from "lucide-react";
import { PAYMENT_WA } from "@/lib/payment/config";
import { DEFAULT_PLAN_PRICES, mergePlanPrices } from "@/lib/payment/plans";

function fmtPlanPrice(n: number) {
  return Math.round(n).toLocaleString("id-ID");
}

const TRADES = [
  { type: "retail", label: "Toko retail", desc: "Stok, barcode, kasir, laporan", icon: Store, modules: ["Inventory dan barcode", "Kasir", "Keuangan bisnis", "Laporan omzet"] },
  { type: "ternak", label: "Peternakan", desc: "Batch, pakan, panen, biaya", icon: Bird, modules: ["Manajemen batch", "Catat pakan dan panen", "Keuangan ternak", "Catatan usaha"] },
  { type: "kuliner", label: "Kuliner", desc: "Menu, meja, kasir, stok bahan", icon: UtensilsCrossed, modules: ["Kasir F&B", "Master menu", "Stok bahan", "Karyawan toko"] },
  { type: "homeindustry", label: "Home industry", desc: "Resep, produksi, HPP", icon: Factory, modules: ["Produksi dan resep", "HPP", "Inventory", "Hitung laba"] },
  { type: "jasa", label: "Jasa", desc: "Order klien, fee, status", icon: Briefcase, modules: ["Order jasa", "Catat fee", "Keuangan", "CRM klien"] },
  { type: "wholesale", label: "Grosir", desc: "Harga partai, MOQ, stok", icon: Truck, modules: ["Harga grosir dan MOQ", "Inventory partai", "Kasir", "Piutang"] },
  { type: "olshop", label: "Online shop", desc: "Stok dan marketplace", icon: ShoppingBag, modules: ["Stok olshop", "Unggah CSV marketplace", "Fee channel", "Omzet multi-channel"] },
  { type: "kesehatan", label: "Kesehatan", desc: "ED obat, stok kritis, kasir", icon: Heart, modules: ["Pantau kedaluwarsa", "Stok kritis", "Kasir", "Laporan"] },
  { type: "pertanian", label: "Pertanian", desc: "Lahan, panen, saprotan", icon: Leaf, modules: ["Lahan dan panen", "Saprotan", "Biaya produksi", "Keuangan"] },
  { type: "bengkel", label: "Bengkel", desc: "Antrian servis, sparepart", icon: Wrench, modules: ["Antrian kendaraan", "Sparepart", "Status servis", "Kasir"] },
  { type: "custom", label: "Usaha lain", desc: "Modul dasar untuk jenis di luar daftar", icon: PenLine, modules: ["Keuangan", "Inventory", "Kasir", "Pajak"] },
];

const SHARED = [
  { name: "Keuangan", detail: "Pemasukan dan pengeluaran usaha." },
  { name: "Kasir", detail: "Transaksi toko dari HP atau desktop." },
  { name: "Stok", detail: "Produk, bahan, atau batch, ikut jenis usaha." },
  { name: "Pajak", detail: "Catatan untuk hitung pajak dan NPWP." },
  { name: "Marketplace", detail: "Data Shopee, TikTok, dan Tokopedia." },
  { name: "Laba", detail: "Untung dari harga, modal, dan fee." },
];

function buildHomePlans(prices: ReturnType<typeof mergePlanPrices>, trialDays: number) {
  return [
    { name: "Gratis", price: "0", period: "/bulan", features: ["1 bisnis", "Keuangan basic", "Dashboard owner basic"], cta: "Daftar paket Gratis", href: "/signup?plan=gratis" },
    { name: "Starter", price: fmtPlanPrice(prices.starter), period: "/bulan", features: ["2 bisnis", "Inventory 50 produk", "Export Excel/PDF"], cta: "Daftar paket Starter", href: "/signup?plan=starter" },
    { name: "Pro", price: fmtPlanPrice(prices.pro), period: "/bulan", features: ["5 bisnis", "Kasir", "Marketplace"], cta: `Coba Pro ${trialDays} hari`, href: "/signup?plan=pro" },
    { name: "Enterprise", price: fmtPlanPrice(prices.enterprise), period: "/bulan", features: ["Unlimited bisnis", "API access", "Dedicated support"], cta: "Tanya lewat WhatsApp", href: "" },
  ];
}

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [playType, setPlayType] = useState("kuliner");
  const [paymentWa, setPaymentWa] = useState(PAYMENT_WA);
  const [priceNote, setPriceNote] = useState("Memuat harga terbaru.");
  const [plans, setPlans] = useState(() => buildHomePlans(DEFAULT_PLAN_PRICES, 5));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/platform")
      .then((r) => {
        if (!r.ok) throw new Error("platform");
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        if (d.payment_wa) setPaymentWa(String(d.payment_wa).replace(/\D/g, "") || PAYMENT_WA);
        const days = typeof d.trial_days === "number" ? d.trial_days : 5;
        setPlans(buildHomePlans(mergePlanPrices(d.plan_prices), days));
        setPriceNote("");
      })
      .catch(() => {
        if (!cancelled) setPriceNote("Harga terbaru tidak terbaca. Angka di bawah adalah harga bawaan.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const activePlay = TRADES.find((b) => b.type === playType) || TRADES[0];
  const waHref = `https://wa.me/${paymentWa}`;

  return (
    <div className="min-h-screen bg-[#12141A] text-[#F4F1EA]">
      <header className="border-b border-[#8A8478]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:h-16">
          <Link href="/" className="flex min-h-11 items-center gap-2.5">
            <Image
              src="/logo-gercep.png"
              alt=""
              width={32}
              height={32}
              priority
              className="h-8 w-8 rounded-md object-cover"
            />
            <span className="text-sm font-semibold">Gercep AI</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-[#C8C2B6] md:flex" aria-label="Utama">
            <a href="#fitur" className="inline-flex min-h-11 items-center hover:text-[#F4F1EA]">Modul</a>
            <a href="#playground" className="inline-flex min-h-11 items-center hover:text-[#F4F1EA]">Jenis usaha</a>
            <a href="#harga" className="inline-flex min-h-11 items-center hover:text-[#F4F1EA]">Harga</a>
            <a href={waHref} className="inline-flex min-h-11 items-center hover:text-[#F4F1EA]">WhatsApp</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden min-h-11 items-center px-2 text-sm text-[#C8C2B6] hover:text-[#F4F1EA] sm:inline-flex">
              Masuk
            </Link>
            <Link href="/signup" className="hidden min-h-11 items-center rounded-lg bg-[#5B21B6] px-3 text-sm font-semibold text-[#F8F5FF] hover:bg-[#4C1D95] sm:inline-flex">
              Daftar akun
            </Link>
            <button
              type="button"
              aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
              aria-expanded={mobileOpen}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#F4F1EA] hover:bg-[#1A1D24] md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>
        {mobileOpen ? (
          <nav className="border-t border-[#8A8478] px-4 py-3 md:hidden" aria-label="Menu ponsel">
            <div className="flex flex-col">
              <a href="#fitur" onClick={() => setMobileOpen(false)} className="min-h-11 py-3 text-sm text-[#C8C2B6]">Modul</a>
              <a href="#playground" onClick={() => setMobileOpen(false)} className="min-h-11 py-3 text-sm text-[#C8C2B6]">Jenis usaha</a>
              <a href="#harga" onClick={() => setMobileOpen(false)} className="min-h-11 py-3 text-sm text-[#C8C2B6]">Harga</a>
              <a href={waHref} onClick={() => setMobileOpen(false)} className="min-h-11 py-3 text-sm text-[#C8C2B6]">WhatsApp</a>
              <Link href="/login" onClick={() => setMobileOpen(false)} className="min-h-11 py-3 text-sm text-[#C8C2B6]">Masuk</Link>
              <Link href="/signup" onClick={() => setMobileOpen(false)} className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#5B21B6] text-sm font-semibold text-[#F8F5FF]">
                Daftar akun
              </Link>
            </div>
          </nav>
        ) : null}
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Kasir, stok, dan uang usaha dalam satu tempat.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[#C8C2B6]">
              Untuk toko, kuliner, ternak, olshop, bengkel, dan usaha lain. Modul yang tampil ikut jenis yang kamu pilih waktu daftar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex min-h-11 items-center rounded-lg bg-[#5B21B6] px-4 text-sm font-semibold text-[#F8F5FF] hover:bg-[#4C1D95]">
                Daftar akun
              </Link>
              <a href="#playground" className="inline-flex min-h-11 items-center rounded-lg border border-[#8A8478] px-4 text-sm text-[#F4F1EA] hover:bg-[#1A1D24]">
                Lihat jenis usaha
              </a>
            </div>
          </div>
          <p className="border-t border-[#8A8478] pt-4 text-sm leading-relaxed text-[#C8C2B6] lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            Akun gratis bisa dipakai untuk catat keuangan dasar. Kasir, stok, dan marketplace ada di paket berbayar. Harga lengkap ada di bawah.
          </p>
        </section>

        <section id="playground" className="border-t border-[#8A8478]">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <h2 className="text-2xl font-semibold">Jenis usaha</h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#C8C2B6]">
                Pilih yang paling dekat. Daftar modul di samping adalah yang disiapkan untuk jenis itu.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TRADES.map((b) => {
                  const active = b.type === playType;
                  const Icon = b.icon;
                  return (
                    <button
                      key={b.type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPlayType(b.type)}
                      className={[
                        "min-h-11 rounded-lg border px-3 py-3 text-left",
                        active
                          ? "border-[#E9D5FF] bg-[#2A2140]"
                          : "border-[#8A8478] bg-[#1A1D24] hover:bg-[#2A2140]",
                      ].join(" ")}
                    >
                      <Icon size={16} aria-hidden="true" className={active ? "text-[#E9D5FF]" : "text-[#C8C2B6]"} />
                      <span className="mt-2 block text-sm font-medium">{b.label}</span>
                      <span className="mt-1 block text-xs leading-snug text-[#C8C2B6]">{b.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="border-t border-[#8A8478] pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
              <h3 className="text-lg font-semibold">{activePlay.label}</h3>
              <p className="mt-1 text-sm text-[#C8C2B6]">Modul yang disiapkan</p>
              <ul className="mt-4 space-y-2 text-sm">
                {activePlay.modules.map((m) => (
                  <li key={m} className="border-b border-[#8A8478] py-2">{m}</li>
                ))}
              </ul>
              <Link
                href={`/signup?biz=${activePlay.type}`}
                className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-[#E9D5FF] underline decoration-[#5B21B6] underline-offset-4"
              >
                Daftar untuk {activePlay.label}
              </Link>
            </div>
          </div>
        </section>

        <section id="fitur" className="border-t border-[#8A8478]">
          <div className="mx-auto max-w-5xl px-4 py-12">
            <h2 className="text-2xl font-semibold">Yang dikerjakan di dalam</h2>
            <dl className="mt-6 divide-y divide-[#8A8478] border-y border-[#8A8478]">
              {SHARED.map((item) => (
                <div key={item.name} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                  <dt className="font-medium">{item.name}</dt>
                  <dd className="text-sm text-[#C8C2B6]">{item.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="harga" className="border-t border-[#8A8478]">
          <div className="mx-auto max-w-5xl px-4 py-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-2xl font-semibold">Harga</h2>
              <Link href="/pricing" className="text-sm text-[#E9D5FF] underline decoration-[#5B21B6] underline-offset-4">
                Rincian per fitur
              </Link>
            </div>
            {priceNote ? (
              <p className="mt-3 text-sm text-[#C8C2B6]" role="status">{priceNote}</p>
            ) : null}
            <div className="mt-6 divide-y divide-[#8A8478] border-y border-[#8A8478]">
              {plans.map((p) => {
                const href = p.name === "Enterprise" ? waHref : p.href;
                const external = p.name === "Enterprise";
                return (
                  <div key={p.name} className="grid gap-3 py-5 sm:grid-cols-[9rem_1fr_auto] sm:items-center">
                    <div>
                      <h3 className="font-semibold">{p.name}</h3>
                      <p className="mt-1 text-sm text-[#C8C2B6]">
                        Rp {p.price}
                        <span>{p.period}</span>
                      </p>
                    </div>
                    <ul className="text-sm text-[#C8C2B6]">
                      {p.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    {external ? (
                      <a href={href} className="inline-flex min-h-11 items-center text-sm font-semibold text-[#E9D5FF] underline decoration-[#5B21B6] underline-offset-4">
                        {p.cta}
                      </a>
                    ) : p.name === "Pro" ? (
                      <Link href={href} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#5B21B6] px-3 text-sm font-semibold text-[#F8F5FF] hover:bg-[#4C1D95]">
                        {p.cta}
                      </Link>
                    ) : (
                      <Link href={href} className="inline-flex min-h-11 items-center text-sm font-semibold text-[#E9D5FF] underline decoration-[#5B21B6] underline-offset-4">
                        {p.cta}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#8A8478]">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-[#C8C2B6] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 PT Henima Collection Indonesia</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Bawah">
            <Link href="/login" className="inline-flex min-h-11 items-center">Masuk</Link>
            <Link href="/pricing" className="inline-flex min-h-11 items-center">Harga</Link>
            <a href={waHref} className="inline-flex min-h-11 items-center">WhatsApp</a>
            <Link href="/privacy" className="inline-flex min-h-11 items-center">Privasi</Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center">Ketentuan</Link>
            <Link href="/kebijakan-data" className="inline-flex min-h-11 items-center">Kebijakan data</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
