"use client";
import { useState, useEffect, useRef, Suspense, lazy } from "react";
import { motion, useInView } from "framer-motion";
import {
  Wallet, ShoppingCart, Receipt, FileText, TrendingUp, Brain, Sparkles, ChevronDown, ArrowRight, Check,
  Globe, Shield, Clock, Zap, Eye, Layout, MessageCircle, Star, Menu, X,
  Store, Bird, UtensilsCrossed, Factory, Briefcase, Truck, ShoppingBag, Heart, Leaf, Wrench, PenLine, Package,
} from "lucide-react";

const HeroScene = lazy(() => import("./components/home-3d/hero-scene"));
const WaveScene = lazy(() => import("./components/home-3d/wave-scene"));
const BgParticles = lazy(() => import("./components/home-3d/bg-particles"));
const LaptopScene = lazy(() => import("./components/home-3d/laptop-scene"));
const BootSequence = lazy(() =>
  import("./components/home-3d/command-center").then((m) => ({ default: m.BootSequence })),
);
const HudOverlay = lazy(() =>
  import("./components/home-3d/command-center").then((m) => ({ default: m.HudOverlay })),
);
const AICore = lazy(() =>
  import("./components/home-3d/command-center").then((m) => ({ default: m.AICore })),
);
import { DecodeText } from "./components/home-3d/decode-text";
import { PAYMENT_WA } from "@/lib/payment/config";
import { DEFAULT_PLAN_PRICES, mergePlanPrices } from "@/lib/payment/plans";
import { useLightHome } from "./components/home-3d/use-light-home";

function fmtPlanPrice(n: number) {
  return Math.round(n).toLocaleString("id-ID");
}

const heading3D = {
  textShadow: [
    "0 1px 0 #0f766e", "0 2px 0 #0d6d66", "0 3px 0 #0b645e", "0 4px 0 #0a5b56",
    "0 5px 0 #08524e", "0 6px 0 rgba(8,82,78,0.7)", "0 7px 0 rgba(8,82,78,0.4)",
    "0 12px 24px rgba(0,0,0,0.95)", "0 0 70px rgba(45,212,191,0.4)",
  ].join(", "),
};

function Heading3D({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.h2
      initial={{ opacity: 0, rotateX: 55, y: 60, scale: 0.9 }}
      whileInView={{ opacity: 1, rotateX: 0, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className={className}
      style={{ fontFamily: "'Space Grotesk', sans-serif", transformPerspective: 900, transformStyle: "preserve-3d", ...heading3D }}>
      {children}
    </motion.h2>
  );
}

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let s = 0; const step = Math.ceil(target / 50);
    const iv = setInterval(() => { s += step; if (s >= target) { setCount(target); clearInterval(iv); } else setCount(s); }, 30);
    return () => clearInterval(iv);
  }, [inView, target]);
  return <span ref={ref}>{count.toLocaleString("id-ID")}{suffix}</span>;
}

const fadeUp = { hidden: { opacity: 0, y: 50 }, visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

const glow = (color: string, size = 400) => `radial-gradient(${size}px circle, ${color}, transparent 70%)`;

const FEATURES = [
  { icon: Wallet, title: "Keuangan AI", desc: "Catat transaksi pakai bahasa biasa", color: "#38BDF8" },
  { icon: ShoppingCart, title: "Marketplace Center", desc: "Analisis Shopee, TikTok, Tokopedia", color: "#F97316" },
  { icon: Receipt, title: "AI Kasir", desc: "Kasir pintar untuk semua toko", color: "#2DD4BF" },
  { icon: FileText, title: "Pajak NPWP", desc: "Hitung pajak otomatis & akurat", color: "#A78BFA" },
  { icon: TrendingUp, title: "Smart Profit", desc: "Tau untung sebelum jual", color: "#4ADE80" },
  { icon: Brain, title: "Insight AI", desc: "Rekomendasi bisnis dari AI", color: "#EC4899" },
];

/** Playground: tap jenis bisnis → modul apa yang Gercep kasih */
const PLAYGROUND = [
  { type: "retail", label: "Toko Retail", desc: "Stok, barcode, kasir, laporan", icon: Store, color: "#38BDF8", modules: ["Inventory & barcode", "AI Kasir", "Keuangan bisnis", "Laporan omzet"] },
  { type: "ternak", label: "Peternakan", desc: "Batch, pakan, panen, biaya", icon: Bird, color: "#2DD4BF", modules: ["Manajemen batch", "Catat pakan & panen", "Keuangan ternak", "Insight AI"] },
  { type: "kuliner", label: "Kuliner / F&B", desc: "Menu, meja, kasir, stok bahan", icon: UtensilsCrossed, color: "#F59E0B", modules: ["Kasir F&B", "Master menu", "Stok bahan", "Karyawan toko"] },
  { type: "homeindustry", label: "Home Industry", desc: "Resep, produksi, HPP", icon: Factory, color: "#8B5CF6", modules: ["Produksi & resep", "HPP otomatis", "Inventory", "Smart Profit"] },
  { type: "jasa", label: "Jasa / Freelance", desc: "Order klien, fee, status", icon: Briefcase, color: "#EC4899", modules: ["Order jasa", "Catat fee", "Keuangan", "CRM klien"] },
  { type: "wholesale", label: "Grosir / Distributor", desc: "Harga partai, MOQ, stok", icon: Truck, color: "#6366F1", modules: ["Harga grosir & MOQ", "Inventory partai", "AI Kasir", "Piutang"] },
  { type: "olshop", label: "Online Shop", desc: "Stok + Shopee/TikTok/Tokped", icon: ShoppingBag, color: "#F43F5E", modules: ["Stok olshop", "Upload CSV marketplace", "Analisis fee", "Omzet multi-channel"] },
  { type: "kesehatan", label: "Kesehatan / Klinik", desc: "ED obat, stok kritis, kasir", icon: Heart, color: "#10B981", modules: ["Pantau kadaluarsa", "Stok kritis", "AI Kasir", "Laporan"] },
  { type: "pertanian", label: "Pertanian", desc: "Lahan, panen, saprotan", icon: Leaf, color: "#84CC16", modules: ["Lahan & panen", "Saprotan", "Biaya produksi", "Keuangan"] },
  { type: "bengkel", label: "Bengkel / Otomotif", desc: "Antrian servis, sparepart", icon: Wrench, color: "#EF4444", modules: ["Antrian kendaraan", "Sparepart", "Status servis", "Kasir"] },
  { type: "custom", label: "Bisnis Lainnya", desc: "Modul universal semua jenis", icon: PenLine, color: "#A78BFA", modules: ["Keuangan AI", "Inventory", "AI Kasir", "Pajak & insight"] },
];

const NAV_LINKS_BASE = [
  { label: "Fitur", href: "#fitur" },
  { label: "Playground", href: "#playground" },
  { label: "Harga", href: "/pricing" },
  { label: "Tentang", href: "#tentang" },
];

const STATS = [
  { value: 1000, suffix: "+", label: "UMKM Terbantu", icon: Globe, color: "#2DD4BF" },
  { value: 50000, suffix: "+", label: "Transaksi Diproses", icon: Zap, color: "#8B5CF6" },
  { value: 99, suffix: ".9%", label: "Uptime System", icon: Shield, color: "#EC4899" },
  { value: 24, suffix: "/7", label: "AI Assistant", icon: Clock, color: "#38BDF8" },
];

function buildHomePlans(prices: ReturnType<typeof mergePlanPrices>, trialDays: number) {
  return [
    { name: "Gratis", price: "0", period: "/bulan", color: "#8B8AA0", features: ["1 bisnis", "Keuangan basic", "Dashboard Owner basic"], cta: "Mulai Gratis" },
    { name: "Starter", price: fmtPlanPrice(prices.starter), period: "/bulan", color: "#38BDF8", features: ["2 bisnis", "Inventory 50 produk", "Export Excel/PDF"], cta: "Pilih Starter" },
    { name: "Pro", price: fmtPlanPrice(prices.pro), period: "/bulan", color: "#2DD4BF", popular: true, features: ["5 bisnis", "AI Kasir universal", "Marketplace Center"], cta: `Coba ${trialDays} Hari Gratis` },
    { name: "Enterprise", price: fmtPlanPrice(prices.enterprise), period: "/bulan", color: "#A78BFA", features: ["Unlimited bisnis", "API access", "Dedicated support"], cta: "Hubungi Kami" },
  ];
}

function GlowDivider() {
  return <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(45,212,191,0.3), rgba(139,92,246,0.3), rgba(236,72,153,0.2), transparent)" }} />;
}

function NebulaBlob({ color, position, size = 500 }: { color: string; position: string; size?: number }) {
  return <div className="absolute pointer-events-none" style={{ [position.includes("top") ? "top" : "bottom"]: position.includes("top") ? "0" : "0", [position.includes("left") ? "left" : "right"]: "0", width: size, height: size, background: `radial-gradient(circle, ${color}, transparent 70%)`, filter: `blur(${size / 4}px)`, opacity: 0.12 }} />;
}

export default function Home() {
  const [is3D, setIs3D] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [playType, setPlayType] = useState("kuliner");
  const [paymentWa, setPaymentWa] = useState(PAYMENT_WA);
  const [, setTrialDays] = useState(5);
  const [plans, setPlans] = useState(() => buildHomePlans(DEFAULT_PLAN_PRICES, 5));
  const lightHome = useLightHome();

  useEffect(() => {
    fetch("/api/public/platform")
      .then((r) => r.json())
      .then((d) => {
        if (d.payment_wa) setPaymentWa(String(d.payment_wa).replace(/\D/g, "") || PAYMENT_WA);
        const days = typeof d.trial_days === "number" ? d.trial_days : 5;
        setTrialDays(days);
        setPlans(buildHomePlans(mergePlanPrices(d.plan_prices), days));
      })
      .catch(() => {});
  }, []);

  // Desktop: enable 3D after mount. Mobile/light: never load heavy canvases.
  useEffect(() => {
    if (lightHome) {
      setIs3D(false);
      return;
    }
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => setIs3D(true), { timeout: 1200 })
      : window.setTimeout(() => setIs3D(true), 400);
    return () => {
      if (typeof idle === "number") window.clearTimeout(idle);
      else window.cancelIdleCallback?.(idle as number);
    };
  }, [lightHome]);
  const activePlay = PLAYGROUND.find((b) => b.type === playType) || PLAYGROUND[0];
  const showHeavy3D = is3D && !lightHome;
  const navLinks = [...NAV_LINKS_BASE, { label: "Kontak", href: `https://wa.me/${paymentWa}` }];
  const plansList = plans;

  return (
    <main className="min-h-screen overflow-x-hidden relative" style={{ background: "#050508", color: "#F2F1F8" }}>
      {showHeavy3D && (
        <Suspense fallback={null}>
          <BootSequence />
          <HudOverlay />
          <AICore />
          <BgParticles />
        </Suspense>
      )}

      {/* ═══ NAV (desktop + mobile) ═══ */}
      <nav
        className="fixed top-0 right-0 left-0 z-50"
        style={{
          background: "rgba(5,5,8,0.72)",
          backdropFilter: "blur(25px)",
          borderBottom: "1px solid rgba(45,212,191,0.08)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:h-16 sm:px-6">
          <a href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-gercep.png" alt="Gercep AI" className="h-8 w-8 rounded-lg object-cover" style={{ boxShadow: "0 0 15px rgba(45,212,191,0.3)" }} />
            <span className="text-sm font-bold tracking-wide">GERCEP AI</span>
          </a>
          <div className="hidden items-center gap-8 text-xs text-[#8B8AA0] md:flex">
            {navLinks.map((l) => (
              <a key={l.label} href={l.href} className="transition-colors hover:text-[#2DD4BF]">{l.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/login" className="hidden text-xs text-[#8B8AA0] transition-colors hover:text-white sm:inline">Masuk</a>
            <a href="/signup" className="relative hidden overflow-hidden rounded-xl px-4 py-2 text-xs font-bold sm:inline-flex"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#050508", boxShadow: "0 0 25px rgba(45,212,191,0.3)" }}>
              <span className="relative">Mulai Gratis</span>
            </a>
            <button
              type="button"
              aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
              className="rounded-lg p-2 text-[#F2F1F8] hover:bg-white/[0.06] md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="border-t border-white/[0.06] px-4 py-4 md:hidden" style={{ background: "rgba(8,8,14,0.98)" }}>
            <div className="flex flex-col gap-1">
              {navLinks.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-3 py-3 text-sm text-[#C4C3D4] hover:bg-white/[0.04] hover:text-[#2DD4BF]"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">
                <a href="/login" onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 py-3 text-center text-sm text-[#8B8AA0]">Masuk</a>
                <a href="/signup" onClick={() => setMobileOpen(false)} className="rounded-xl py-3 text-center text-sm font-bold text-[#050508]"
                  style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)" }}>Mulai Gratis</a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
        {showHeavy3D && (
          <Suspense fallback={null}>
            <HeroScene />
          </Suspense>
        )}
        {/* Mobile: CSS atmosphere instead of WebGL hero */}
        {lightHome && (
          <>
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at 70% 20%, rgba(45,212,191,0.18), transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(139,92,246,0.16), transparent 45%), radial-gradient(ellipse at 50% 50%, rgba(236,72,153,0.08), transparent 55%)",
              }}
            />
          </>
        )}
        <NebulaBlob color="#2DD4BF" position="top-right" size={800} />
        <NebulaBlob color="#8B5CF6" position="bottom-left" size={600} />
        <NebulaBlob color="#EC4899" position="top-left" size={400} />

        <div className="relative z-10 max-w-[1200px] mx-auto px-6 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-bold tracking-[0.2em] uppercase text-[#2DD4BF] mb-8"
                style={{ border: "1px solid rgba(45,212,191,0.3)", background: "rgba(45,212,191,0.06)", boxShadow: "0 0 30px rgba(45,212,191,0.1)" }}>
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2DD4BF] opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#2DD4BF]" /></span>
                <DecodeText text="AI-Powered Business OS" delay={lightHome ? 0 : 2900} instant={lightHome} />
              </span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 60, rotateX: 45 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.1, duration: 1.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.05] tracking-tight mb-6"
              style={{ fontFamily: "'Space Grotesk', sans-serif", transformPerspective: 900, ...heading3D }}>
              <DecodeText text="Business OS" delay={lightHome ? 0 : 3000} instant={lightHome} />{" "}
              <span className="block" style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6, #EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 25px rgba(139,92,246,0.4))" }}>
                <DecodeText text="Masa Depan untuk" delay={lightHome ? 0 : 3350} instant={lightHome} />
              </span>
              <DecodeText text="UMKM Indonesia" delay={lightHome ? 0 : 3700} instant={lightHome} />
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.8 }}
              className="text-sm sm:text-base text-[#8B8AA0] mb-8 max-w-[480px] leading-relaxed">
              Kelola keuangan, inventory, kasir, marketplace, pajak — cocok untuk retail, F&amp;B, ternak, olshop, bengkel, dan bisnis lain.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }} className="flex flex-wrap items-center gap-3 mb-8">
              <a href="/signup" className="group relative flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold overflow-hidden"
                style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#050508", boxShadow: "0 0 60px rgba(45,212,191,0.4), 0 0 120px rgba(139,92,246,0.15)" }}>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative">Mulai Gratis</span> <ArrowRight size={16} className="relative" />
              </a>
              <a href="#playground" className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm text-[#8B8AA0] hover:text-white transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)" }}>
                Coba Playground <Eye size={14} />
              </a>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="flex items-center gap-4 mb-6">
              <div className="flex -space-x-2">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-[#050508] flex items-center justify-center text-[9px] font-bold"
                    style={{ background: ["linear-gradient(135deg,#2DD4BF,#0D9488)", "linear-gradient(135deg,#8B5CF6,#6D28D9)", "linear-gradient(135deg,#EC4899,#BE185D)", "linear-gradient(135deg,#38BDF8,#0284C7)"][i], zIndex: 4 - i, boxShadow: "0 0 8px rgba(0,0,0,0.5)" }}>
                    {["M", "A", "R", "K"][i]}
                  </div>
                ))}
              </div>
              <p className="text-xs text-[#8B8AA0]"><span className="text-[#2DD4BF] font-bold">1.000+</span> UMKM sudah bergabung</p>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }} className="flex flex-wrap gap-5 text-[10px] text-[#5A5B7A]">
              {[{ icon: Sparkles, text: "AI Canggih" }, { icon: Shield, text: "Aman & Terpercaya" }, { icon: Zap, text: "Mudah Digunakan" }].map(b => (
                <span key={b.text} className="flex items-center gap-1.5"><b.icon size={11} className="text-[#2DD4BF]" />{b.text}</span>
              ))}
            </motion.div>
          </div>

          <div className="hidden lg:flex flex-col items-end gap-4">
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
              className="rounded-2xl p-4 w-[220px]"
              style={{ border: "1px solid rgba(45,212,191,0.2)", background: "rgba(10,10,20,0.6)", backdropFilter: "blur(20px)", boxShadow: "0 0 40px rgba(45,212,191,0.1), inset 0 0 30px rgba(45,212,191,0.03)" }}>
              <p className="text-[9px] uppercase tracking-wider text-[#5A5B7A] mb-1">Transaksi Hari Ini</p>
              <p className="text-2xl font-black" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#2DD4BF", textShadow: "0 0 20px rgba(45,212,191,0.5)" }}>12.458</p>
              <span className="text-[9px] text-[#4ADE80]">↑ 23.5%</span>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 }}
              className="rounded-2xl p-4 w-[260px] mr-10"
              style={{ border: "1px solid rgba(139,92,246,0.2)", background: "rgba(10,10,20,0.6)", backdropFilter: "blur(20px)", boxShadow: "0 0 40px rgba(139,92,246,0.1), inset 0 0 30px rgba(139,92,246,0.03)" }}>
              <p className="text-[9px] uppercase tracking-wider text-[#5A5B7A] mb-1">Omzet Bulan Ini</p>
              <p className="text-xl font-black" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA", textShadow: "0 0 20px rgba(139,92,246,0.5)" }}>Rp 125.430.000</p>
              <span className="text-[9px] text-[#4ADE80]">↑ 18.2%</span>
            </motion.div>
          </div>
        </div>

        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"><ChevronDown size={16} className="text-[#3A3B52]" /></motion.div>
      </section>

      <GlowDivider />

      {/* ═══ FEATURES ═══ */}
      <section id="fitur" className="py-24 px-6 relative">
        <NebulaBlob color="#38BDF8" position="top-left" size={500} />
        <NebulaBlob color="#EC4899" position="bottom-right" size={400} />
        <div className="max-w-[1100px] mx-auto relative z-10">
          <div className="mb-10 text-center">
            <p className="mb-2 text-[10px] font-bold tracking-[0.2em] text-[#38BDF8] uppercase">Apa itu Gercep AI?</p>
            <Heading3D className="mb-3 text-3xl font-black sm:text-4xl">Satu OS untuk semua modul bisnis</Heading3D>
            <p className="mx-auto max-w-lg text-sm text-[#8B8AA0]">Bukan cuma kasir. Ini aplikasi lengkap: keuangan, stok, pajak, marketplace, dan AI insight.</p>
          </div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {FEATURES.map(f => (
              <motion.div key={f.title} variants={fadeUp}
                className="group rounded-2xl p-5 text-center cursor-default overflow-hidden relative"
                style={{ background: "rgba(6,6,12,0.88)", border: `1px solid ${f.color}20`, backdropFilter: "blur(20px)", transition: "all 0.4s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = f.color + "50"; e.currentTarget.style.boxShadow = `0 0 40px ${f.color}20, inset 0 0 40px ${f.color}05`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = f.color + "15"; e.currentTarget.style.boxShadow = "none"; }}>
                <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(90deg, transparent, ${f.color}, transparent)`, boxShadow: `0 0 10px ${f.color}` }} />
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-4"
                  style={{ background: f.color + "10", border: `1px solid ${f.color}25`, boxShadow: `0 0 25px ${f.color}15` }}>
                  <f.icon size={24} style={{ color: f.color, filter: `drop-shadow(0 0 8px ${f.color})` }} />
                </div>
                <h3 className="text-xs font-bold mb-1.5">{f.title}</h3>
                <p className="text-[10px] text-[#5A5B7A] leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <GlowDivider />

      {/* ═══ BUSINESS PLAYGROUND ═══ */}
      <section id="playground" className="relative px-6 py-24">
        <NebulaBlob color="#2DD4BF" position="top-right" size={600} />
        <NebulaBlob color="#8B5CF6" position="bottom-left" size={500} />
        <div className="relative z-10 mx-auto max-w-[1100px]">
          <div className="mb-8 text-center sm:mb-10">
            <p className="mb-2 text-[10px] font-bold tracking-[0.2em] text-[#2DD4BF] uppercase">Playground bisnis</p>
            <Heading3D className="mb-3 text-3xl font-black sm:text-4xl">Tap jenis bisnismu</Heading3D>
            <p className="mx-auto max-w-lg text-sm text-[#8B8AA0]">
              Lihat modul untuk toko, F&amp;B, ternak, olshop, bengkel, dan lainnya — biar jelas ini aplikasi apa dan cocok untuk siapa.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {PLAYGROUND.map((b) => {
                const active = b.type === playType;
                return (
                  <button
                    key={b.type}
                    type="button"
                    onClick={() => setPlayType(b.type)}
                    className="rounded-2xl p-3.5 text-left transition-all sm:p-4"
                    style={{
                      background: active ? `${b.color}14` : "rgba(6,6,12,0.9)",
                      border: `1px solid ${active ? b.color + "55" : "rgba(255,255,255,0.06)"}`,
                      boxShadow: active ? `0 0 28px ${b.color}22` : "none",
                    }}
                  >
                    <div
                      className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: b.color + "18", border: `1px solid ${b.color}30` }}
                    >
                      <b.icon size={18} style={{ color: b.color }} />
                    </div>
                    <p className="text-xs font-bold text-[#F0EFF8]">{b.label}</p>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-[#5A5B7A]">{b.desc}</p>
                  </button>
                );
              })}
            </div>

            <motion.div
              key={activePlay.type}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-3xl p-5 sm:p-6"
              style={{
                background: "rgba(8,8,16,0.95)",
                border: `1px solid ${activePlay.color}35`,
                boxShadow: `0 0 50px ${activePlay.color}12`,
              }}
            >
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: activePlay.color + "18", border: `1px solid ${activePlay.color}35` }}
                >
                  <activePlay.icon size={22} style={{ color: activePlay.color }} />
                </div>
                <div>
                  <p className="text-sm font-bold">{activePlay.label}</p>
                  <p className="text-[11px] text-[#8B8AA0]">Modul yang siap dipakai</p>
                </div>
              </div>

              <ul className="mb-5 space-y-2.5">
                {activePlay.modules.map((m) => (
                  <li key={m} className="flex items-center gap-2.5 text-sm text-[#C4C3D4]">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: activePlay.color + "15" }}
                    >
                      <Check size={12} style={{ color: activePlay.color }} />
                    </span>
                    {m}
                  </li>
                ))}
              </ul>

              <div className="mb-5 flex flex-wrap gap-2">
                {[
                  { icon: Package, label: "Stok" },
                  { icon: Wallet, label: "Keuangan" },
                  { icon: Receipt, label: "Kasir" },
                  { icon: Brain, label: "AI" },
                ].map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] text-[#8B8AA0]"
                    style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
                  >
                    <chip.icon size={11} /> {chip.label}
                  </span>
                ))}
              </div>

              <a
                href={`/signup?biz=${activePlay.type}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold"
                style={{ background: `linear-gradient(135deg, ${activePlay.color}, #8B5CF6)`, color: "#050508" }}
              >
                Mulai untuk {activePlay.label} <ArrowRight size={16} />
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      <GlowDivider />

      {/* ═══ 3D DASHBOARD ═══ */}
      <section id="tentang" className="py-24 px-6 relative overflow-hidden">
        <NebulaBlob color="#8B5CF6" position="top-right" size={700} />
        <NebulaBlob color="#2DD4BF" position="bottom-left" size={500} />
        <div className="max-w-[1200px] mx-auto relative z-10">
          <div className="grid lg:grid-cols-5 gap-8 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="lg:col-span-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#8B5CF6] font-bold mb-3" style={{ textShadow: "0 0 20px rgba(139,92,246,0.5)" }}>3D INTERACTIVE</p>
              <Heading3D className="text-3xl sm:text-4xl font-black mb-5 leading-tight">
                Dashboard Canggih dalam{" "}
                <span style={{ background: "linear-gradient(90deg, #8B5CF6, #EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 15px rgba(139,92,246,0.5))" }}>3D</span>
              </Heading3D>
              <p className="text-sm text-[#8B8AA0] mb-8 max-w-[380px] leading-relaxed">Semua data bisnismu divisualisasikan secara real-time dengan teknologi 3D interaktif.</p>
              <div className="space-y-4">
                {[{ icon: Eye, text: "Visualisasi data real-time", c: "#2DD4BF" }, { icon: Brain, text: "Analitik AI prediktif", c: "#8B5CF6" }, { icon: Layout, text: "Semua dalam satu platform", c: "#EC4899" }].map(f => (
                  <div key={f.text} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: f.c + "10", border: `1px solid ${f.c}25`, boxShadow: `0 0 15px ${f.c}10` }}>
                      <f.icon size={15} style={{ color: f.c, filter: `drop-shadow(0 0 5px ${f.c})` }} />
                    </div>
                    <span className="text-xs text-[#C4C3D4]">{f.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 1.2 }} className="lg:col-span-3 relative">
              <div className="relative w-full h-[420px] sm:h-[520px]" style={{ pointerEvents: "auto" }}>
                {showHeavy3D && (
                  <Suspense
                    fallback={
                      <div className="flex h-full items-center justify-center text-xs text-[#3A3B52]">Loading 3D...</div>
                    }
                  >
                    <LaptopScene />
                  </Suspense>
                )}
                {lightHome && (
                  <div
                    className="flex h-full items-center justify-center rounded-2xl border border-white/[0.08]"
                    style={{ background: "rgba(10,10,20,0.8)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo-gercep.png" alt="" className="h-24 w-24 rounded-2xl object-cover opacity-90" />
                  </div>
                )}
              </div>
              <div className="absolute -inset-10 rounded-3xl -z-10" style={{ background: "radial-gradient(ellipse, rgba(139,92,246,0.12), transparent 60%)", filter: "blur(40px)" }} />
            </motion.div>
          </div>
          <p className="text-center text-[10px] text-[#5A5B7A] mt-4 flex items-center justify-center gap-1.5"><span>🖱</span> Drag untuk memutar laptop</p>
        </div>
      </section>

      <GlowDivider />

      {/* ═══ STATS ═══ */}
      <section className="py-20 px-6 relative">
        <NebulaBlob color="#2DD4BF" position="top-right" size={400} />
        <div className="max-w-[1000px] mx-auto relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {STATS.map(s => (
              <motion.div key={s.label} variants={fadeUp}
                className="text-center rounded-2xl p-6 relative overflow-hidden"
                style={{ background: "rgba(6,6,12,0.9)", border: `1px solid ${s.color}25`, backdropFilter: "blur(20px)", boxShadow: `0 0 40px ${s.color}10, inset 0 0 30px ${s.color}04` }}>
                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${s.color}60, transparent)`, boxShadow: `0 0 10px ${s.color}40` }} />
                <div className="flex h-12 w-12 items-center justify-center rounded-xl mx-auto mb-3"
                  style={{ background: s.color + "12", border: `1px solid ${s.color}25`, boxShadow: `0 0 20px ${s.color}15` }}>
                  <s.icon size={20} style={{ color: s.color, filter: `drop-shadow(0 0 6px ${s.color})` }} />
                </div>
                <p className="text-3xl font-black mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", color: s.color, textShadow: `0 0 25px ${s.color}50` }}>
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </p>
                <p className="text-[10px] text-[#5A5B7A] uppercase tracking-[0.1em] font-semibold">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <GlowDivider />

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-24 px-6 relative">
        <NebulaBlob color="#EC4899" position="top-left" size={500} />
        <NebulaBlob color="#8B5CF6" position="bottom-right" size={400} />
        <div className="max-w-[1100px] mx-auto relative z-10">
          <div className="grid lg:grid-cols-5 gap-10 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="lg:col-span-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#EC4899] font-bold mb-3" style={{ textShadow: "0 0 15px rgba(236,72,153,0.5)" }}>CARA KERJA</p>
              <Heading3D className="text-3xl sm:text-4xl font-black leading-tight">
                3 Langkah Mudah<br />Kelola Bisnismu dengan{" "}
                <span style={{ background: "linear-gradient(90deg, #EC4899, #8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 10px rgba(236,72,153,0.4))" }}>AI</span>
              </Heading3D>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="lg:col-span-3 grid sm:grid-cols-3 gap-4 relative">
              <div className="hidden sm:block absolute top-[32px] left-[15%] right-[15%] h-[2px] z-0"
                style={{ background: "linear-gradient(90deg, #38BDF8, #8B5CF6, #2DD4BF)", boxShadow: "0 0 12px rgba(139,92,246,0.4)" }} />
              {[
                { num: "1", title: "Daftar & pilih jenis bisnis", desc: "Buat akun dan pilih jenis bisnismu.", color: "#38BDF8" },
                { num: "2", title: "Input atau upload data", desc: "Masukkan data transaksi, produk, dan lainnya.", color: "#8B5CF6" },
                { num: "3", title: "AI kasih insight & kelola otomatis", desc: "AI menganalisis dan membantu mengelola bisnismu.", color: "#2DD4BF" },
              ].map(s => (
                <motion.div key={s.num} variants={fadeUp} className="relative z-10 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full mx-auto mb-4 text-sm font-black"
                    style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}80)`, color: "#050508", boxShadow: `0 0 30px ${s.color}50, 0 0 60px ${s.color}20` }}>
                    {s.num}
                  </div>
                  <div className="rounded-2xl p-5 relative overflow-hidden"
                    style={{ background: "rgba(6,6,12,0.9)", border: `1px solid ${s.color}20`, backdropFilter: "blur(20px)" }}>
                    <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${s.color}40, transparent)` }} />
                    <h3 className="text-xs font-bold mb-2">{s.title}</h3>
                    <p className="text-[10px] text-[#8B8AA0] leading-relaxed">{s.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <GlowDivider />

      {/* ═══ PRICING ═══ */}
      <section id="harga" className="py-24 px-6 relative">
        <NebulaBlob color="#2DD4BF" position="top-left" size={500} />
        <NebulaBlob color="#8B5CF6" position="bottom-right" size={400} />
        <div className="max-w-[1100px] mx-auto relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-16">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#2DD4BF] font-bold mb-3" style={{ textShadow: "0 0 15px rgba(45,212,191,0.5)" }}>PAKET HEMAT</p>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <Heading3D className="text-3xl sm:text-4xl font-black leading-tight">
                Pilih Paket yang<br />Sesuai Kebutuhanmu
              </Heading3D>
              <a href="/pricing" className="inline-flex items-center gap-2 text-xs text-[#2DD4BF] hover:underline font-medium">Lihat Semua Paket <ArrowRight size={12} /></a>
            </div>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plansList.map(p => (
              <motion.div key={p.name} variants={fadeUp}
                className="relative rounded-2xl p-6 overflow-hidden"
                style={{
                  background: p.popular ? "linear-gradient(180deg, rgba(8,26,26,0.92), rgba(6,6,12,0.92))" : "rgba(6,6,12,0.88)",
                  border: `1px solid ${p.popular ? "rgba(45,212,191,0.3)" : p.color + "15"}`,
                  backdropFilter: "blur(15px)",
                  boxShadow: p.popular ? "0 0 60px rgba(45,212,191,0.12), inset 0 0 40px rgba(45,212,191,0.03)" : undefined,
                  transition: "all 0.4s",
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 50px ${p.color}15, inset 0 0 30px ${p.color}05`; e.currentTarget.style.borderColor = p.color + "40"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = p.popular ? "0 0 60px rgba(45,212,191,0.12)" : "none"; e.currentTarget.style.borderColor = p.popular ? "rgba(45,212,191,0.3)" : p.color + "15"; }}>
                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${p.color}50, transparent)` }} />
                {p.popular && (
                  <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full text-[8px] font-bold"
                    style={{ background: "linear-gradient(90deg, #EC4899, #8B5CF6)", color: "#fff", boxShadow: "0 0 15px rgba(236,72,153,0.4)" }}>
                    Populer!
                  </div>
                )}
                <p className="text-xs font-bold mb-3" style={{ color: p.color }}>{p.name}</p>
                <p className="mb-4">
                  <span className="text-xs text-[#5A5B7A]">Rp </span>
                  <span className="text-2xl font-black" style={{ fontFamily: "'JetBrains Mono', monospace", color: p.color, textShadow: `0 0 15px ${p.color}40` }}>{p.price}</span>
                  <span className="text-xs text-[#5A5B7A]">{p.period}</span>
                </p>
                <div className="space-y-2 mb-6">
                  {p.features.map(f => (
                    <p key={f} className="flex items-center gap-2 text-[11px] text-[#8B8AA0]">
                      <Check size={11} style={{ color: p.color, filter: `drop-shadow(0 0 4px ${p.color})` }} />{f}
                    </p>
                  ))}
                </div>
                <a href={p.name === "Enterprise" ? `https://wa.me/${paymentWa}` : `/signup?plan=${p.name.toLowerCase()}`}
                  className="block w-full text-center rounded-xl py-2.5 text-xs font-bold transition-all group relative overflow-hidden"
                  style={{
                    background: p.popular ? "linear-gradient(135deg, #2DD4BF, #8B5CF6)" : "transparent",
                    color: p.popular ? "#050508" : p.color,
                    border: p.popular ? "none" : `1px solid ${p.color}30`,
                    boxShadow: p.popular ? "0 0 25px rgba(45,212,191,0.3)" : undefined,
                  }}>
                  {p.popular && <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />}
                  <span className="relative">{p.cta}</span>
                </a>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <GlowDivider />

      {/* ═══ CTA ═══ */}
      <section className="relative py-36 px-6 overflow-hidden">
        {showHeavy3D && (
          <Suspense fallback={null}>
            <WaveScene />
          </Suspense>
        )}
        <NebulaBlob color="#2DD4BF" position="top-left" size={600} />
        <NebulaBlob color="#8B5CF6" position="bottom-right" size={500} />
        <NebulaBlob color="#EC4899" position="top-right" size={400} />
        <div className="relative z-10 text-center max-w-[700px] mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <Heading3D className="text-3xl sm:text-4xl md:text-5xl font-black mb-8 leading-[1.1]">
              Siap Upgrade Bisnismu ke{" "}
              <span className="block sm:inline" style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6, #EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 20px rgba(139,92,246,0.5))" }}>
                Level Berikutnya?
              </span>
            </Heading3D>
            <a href="/signup" className="group relative inline-flex items-center gap-3 px-12 py-5 rounded-2xl text-base font-bold overflow-hidden"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#050508", boxShadow: "0 0 80px rgba(45,212,191,0.4), 0 0 160px rgba(139,92,246,0.15), 0 0 240px rgba(236,72,153,0.08)" }}>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative">Mulai Sekarang, Gratis</span>
              <ArrowRight size={18} className="relative group-hover:translate-x-1 transition-transform" />
            </a>
          </motion.div>
        </div>
      </section>

      <GlowDivider />

      {/* ═══ FOOTER ═══ */}
      <footer className="py-12 px-6 relative" style={{ background: "rgba(3,3,6,0.8)" }}>
        <div className="max-w-[1100px] mx-auto relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <img src="/logo-gercep.png" alt="Gercep AI" className="h-7 w-7 rounded-lg object-cover" style={{ boxShadow: "0 0 10px rgba(45,212,191,0.3)" }} />
                <span className="text-sm font-bold">GERCEP AI</span>
              </div>
              <p className="text-[10px] text-[#3A3B52] leading-relaxed max-w-[200px]">Solusi bisnis all-in-one dengan kecerdasan AI untuk UMKM Indonesia.</p>
            </div>
            {[
              {
                title: "Produk",
                links: [
                  { label: "Fitur", href: "#fitur" },
                  { label: "Playground", href: "#playground" },
                  { label: "Harga", href: "/pricing" },
                ],
              },
              {
                title: "Company",
                links: [
                  { label: "Tentang", href: "#tentang" },
                  { label: "Kontak", href: `https://wa.me/${paymentWa}` },
                  { label: "Masuk", href: "/login" },
                ],
              },
              {
                title: "Legal",
                links: [
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Kebijakan Data", href: "/kebijakan-data" },
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <p className="mb-3 text-[10px] font-bold tracking-[0.15em] text-[#3A3B52] uppercase">{col.title}</p>
                <div className="space-y-2">
                  {col.links.map((l) => (
                    <a key={l.label} href={l.href} className="block text-xs text-[#5A5B7A] transition-colors hover:text-[#2DD4BF]">
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderTop: "1px solid rgba(45,212,191,0.06)" }}>
            <p className="text-[10px] text-[#3A3B52]">&copy; 2026 PT Henima Collection Indonesia. All rights reserved.</p>
            <div className="flex gap-4 text-[#3A3B52]">
              {[Globe, MessageCircle, Star].map((Icon, i) => (
                <a key={i} href="#" className="hover:text-[#2DD4BF] transition-colors"><Icon size={14} /></a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
