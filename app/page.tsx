"use client";
import { useState, useEffect, useRef, Suspense, lazy } from "react";
import { motion, useInView } from "framer-motion";
import { Wallet, ShoppingCart, Receipt, FileText, TrendingUp, Brain, Sparkles, ChevronDown, ArrowRight, Check, Globe, Shield, Clock, Zap, Star, Users, BarChart3, Cpu, Eye, Layout, Code, Headphones, MessageCircle } from "lucide-react";

const HeroScene = lazy(() => import("./components/home-3d/hero-scene"));
const WaveScene = lazy(() => import("./components/home-3d/wave-scene"));
const DashboardScene = lazy(() => import("./components/home-3d/dashboard-scene"));

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(target / 50);
    const interval = setInterval(() => { start += step; if (start >= target) { setCount(target); clearInterval(interval); } else setCount(start); }, 30);
    return () => clearInterval(interval);
  }, [inView, target]);
  return <span ref={ref}>{count.toLocaleString("id-ID")}{suffix}</span>;
}

const fadeUp = { hidden: { opacity: 0, y: 50 }, visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

const FEATURES = [
  { icon: Wallet, title: "Keuangan AI", desc: "Catat transaksi pakai bahasa biasa", color: "#38BDF8" },
  { icon: ShoppingCart, title: "Marketplace Center", desc: "Analisis Shopee, TikTok, Tokopedia", color: "#F97316" },
  { icon: Receipt, title: "AI Kasir", desc: "Kasir pintar untuk semua toko", color: "#2DD4BF" },
  { icon: FileText, title: "Pajak NPWP", desc: "Hitung pajak otomatis & akurat", color: "#A78BFA" },
  { icon: TrendingUp, title: "Smart Profit", desc: "Tau untung sebelum jual", color: "#4ADE80" },
  { icon: Brain, title: "Insight AI", desc: "Rekomendasi bisnis dari AI", color: "#EC4899" },
];

const STATS = [
  { value: 1000, suffix: "+", label: "UMKM Terbantu", icon: Globe, color: "#2DD4BF" },
  { value: 50000, suffix: "+", label: "Transaksi Diproses", icon: Zap, color: "#8B5CF6" },
  { value: 99, suffix: ".9%", label: "Uptime System", icon: Shield, color: "#EC4899" },
  { value: 24, suffix: "/7", label: "AI Assistant", icon: Clock, color: "#38BDF8" },
];

const STEPS = [
  { num: "1", title: "Daftar & pilih jenis bisnis", desc: "Buat akun dan pilih jenis bisnismu.", icon: Users, color: "#38BDF8" },
  { num: "2", title: "Input atau upload data", desc: "Masukkan data transaksi, produk, dan lainnya.", icon: BarChart3, color: "#8B5CF6" },
  { num: "3", title: "AI kasih insight & kelola otomatis", desc: "AI menganalisis dan membantu mengelola bisnismu.", icon: Cpu, color: "#2DD4BF" },
];

const PLANS = [
  { name: "Gratis", price: "0", period: "/bulan", color: "#8B8AA0", features: ["Fitur dasar", "1 User", "Laporan dasar"], cta: "Mulai Gratis" },
  { name: "Starter", price: "79.000", period: "/bulan", color: "#38BDF8", features: ["Fitur lengkap", "5 User", "Laporan lengkap"], cta: "Pilih Paket" },
  { name: "Pro", price: "199.000", period: "/bulan", color: "#2DD4BF", popular: true, features: ["Fitur premium", "Unlimited User", "AI Insight"], cta: "Pilih Paket" },
  { name: "Enterprise", price: "Custom", period: "", color: "#A78BFA", features: ["Solusi khusus", "Integrasi API", "Dedicated Support"], cta: "Hubungi Kami" },
];

export default function Home() {
  const [is3D, setIs3D] = useState(false);
  useEffect(() => { setIs3D(window.innerWidth >= 640 && (navigator.hardwareConcurrency || 4) >= 2); }, []);

  return (
    <main className="min-h-screen overflow-x-hidden" style={{ background: "#070711", color: "#F2F1F8" }}>
      {/* ═══ NAV ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05]" style={{ background: "rgba(7,7,17,0.85)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}>G</div>
            <span className="text-sm font-bold tracking-wide">GERCEP AI</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-xs text-[#8B8AA0]">
            {["Fitur", "Harga", "Blog", "Tentang", "Kontak"].map(l => (
              <a key={l} href={l === "Harga" ? "/pricing" : `#${l.toLowerCase()}`} className="hover:text-white transition-colors">{l}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-xs text-[#8B8AA0] hover:text-white transition-colors">Masuk</a>
            <a href="/signup" className="text-xs px-5 py-2.5 rounded-xl font-bold"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711", boxShadow: "0 0 20px rgba(45,212,191,0.2)" }}>
              Mulai Gratis
            </a>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
        {is3D && <Suspense fallback={null}><HeroScene /></Suspense>}
        {!is3D && <div className="absolute inset-0"><div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]" style={{ background: "conic-gradient(from 0deg, #2DD4BF, #8B5CF6, #EC4899, #2DD4BF)" }} /></div>}

        <div className="relative z-10 max-w-[1200px] mx-auto px-6 grid lg:grid-cols-2 gap-10 items-center">
          {/* Left content */}
          <div>
            <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-bold tracking-[0.2em] uppercase text-[#2DD4BF] mb-8"
                style={{ border: "1px solid rgba(45,212,191,0.3)", background: "rgba(45,212,191,0.06)", boxShadow: "0 0 25px rgba(45,212,191,0.08)" }}>
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2DD4BF] opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#2DD4BF]" /></span>
                AI-Powered Business OS
              </span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.05] tracking-tight mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Business OS{" "}
              <span className="block" style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6, #EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 20px rgba(139,92,246,0.3))" }}>
                Masa Depan untuk
              </span>
              UMKM Indonesia
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.8 }}
              className="text-sm sm:text-base text-[#8B8AA0] mb-8 max-w-[480px] leading-relaxed">
              Kelola keuangan, inventory, kasir, marketplace, pajak — semua dengan kecerdasan AI dalam satu platform.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }}
              className="flex flex-wrap items-center gap-3 mb-8">
              <a href="/signup" className="group relative flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold overflow-hidden"
                style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711", boxShadow: "0 0 50px rgba(45,212,191,0.35)" }}>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative">Mulai Gratis</span> <ArrowRight size={16} className="relative" />
              </a>
              <a href="#fitur" className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm text-[#8B8AA0] hover:text-white transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                Lihat Demo <Eye size={14} />
              </a>
            </motion.div>

            {/* Social proof */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="flex items-center gap-4 mb-6">
              <div className="flex -space-x-2">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-[#070711] flex items-center justify-center text-[9px] font-bold"
                    style={{ background: ["#2DD4BF", "#8B5CF6", "#EC4899", "#38BDF8"][i], zIndex: 4 - i }}>
                    {["M", "A", "R", "K"][i]}
                  </div>
                ))}
              </div>
              <p className="text-xs text-[#8B8AA0]"><span className="text-[#2DD4BF] font-bold">1.000+</span> UMKM sudah bergabung</p>
            </motion.div>

            {/* Trust badges */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
              className="flex flex-wrap gap-4 text-[10px] text-[#5A5B7A]">
              {[{ icon: Sparkles, text: "AI Canggih" }, { icon: Shield, text: "Aman & Terpercaya" }, { icon: Zap, text: "Mudah Digunakan" }].map(b => (
                <span key={b.text} className="flex items-center gap-1.5"><b.icon size={11} className="text-[#2DD4BF]" />{b.text}</span>
              ))}
            </motion.div>
          </div>

          {/* Right side — floating stat cards (visible only on large screens, 3D globe is behind) */}
          <div className="hidden lg:flex flex-col items-end gap-4 relative">
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.8 }}
              className="rounded-2xl border p-4 w-[220px]"
              style={{ borderColor: "rgba(45,212,191,0.15)", background: "rgba(13,13,26,0.7)", backdropFilter: "blur(20px)", boxShadow: "0 0 30px rgba(45,212,191,0.08)" }}>
              <p className="text-[9px] uppercase tracking-wider text-[#5A5B7A] mb-1">Transaksi Hari Ini</p>
              <p className="text-2xl font-black" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#2DD4BF" }}>12.458</p>
              <span className="text-[9px] text-[#4ADE80]">↑ 23.5%</span>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45, duration: 0.8 }}
              className="rounded-2xl border p-4 w-[260px] mr-10"
              style={{ borderColor: "rgba(139,92,246,0.15)", background: "rgba(13,13,26,0.7)", backdropFilter: "blur(20px)", boxShadow: "0 0 30px rgba(139,92,246,0.08)" }}>
              <p className="text-[9px] uppercase tracking-wider text-[#5A5B7A] mb-1">Omzet Bulan Ini</p>
              <p className="text-xl font-black" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#8B5CF6" }}>Rp 125.430.000</p>
              <span className="text-[9px] text-[#4ADE80]">↑ 18.2%</span>
            </motion.div>
          </div>
        </div>

        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1">
          <ChevronDown size={16} className="text-[#3A3B52]" />
        </motion.div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="fitur" className="py-24 px-6 relative">
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "linear-gradient(rgba(45,212,191,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.2) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />
        <div className="max-w-[1100px] mx-auto relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {FEATURES.map(f => (
              <motion.div key={f.title} variants={fadeUp}
                className="group rounded-2xl border border-white/[0.06] p-5 text-center cursor-default overflow-hidden"
                style={{ background: "#0D0D1A", transition: "all 0.4s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = f.color + "40"; e.currentTarget.style.boxShadow = `0 0 30px ${f.color}15`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl mx-auto mb-4"
                  style={{ background: f.color + "12", border: `1px solid ${f.color}20`, boxShadow: `0 0 20px ${f.color}10` }}>
                  <f.icon size={22} style={{ color: f.color }} />
                </div>
                <h3 className="text-xs font-bold mb-1.5">{f.title}</h3>
                <p className="text-[10px] text-[#5A5B7A] leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ 3D DASHBOARD SHOWCASE ═══ */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 50%, rgba(139,92,246,0.06), transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(45,212,191,0.04), transparent 50%)" }} />
        <div className="max-w-[1200px] mx-auto relative">
          <div className="grid lg:grid-cols-5 gap-8 items-center">
            {/* Left text */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="lg:col-span-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#8B5CF6] font-bold mb-3">3D INTERACTIVE</p>
              <h2 className="text-3xl sm:text-4xl font-black mb-5 leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Dashboard Canggih dalam{" "}
                <span style={{ background: "linear-gradient(90deg, #8B5CF6, #EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>3D</span>
              </h2>
              <p className="text-sm text-[#8B8AA0] mb-8 max-w-[380px] leading-relaxed">
                Semua data bisnismu divisualisasikan secara real-time dengan teknologi 3D interaktif.
              </p>
              <div className="space-y-4">
                {[{ icon: Eye, text: "Visualisasi data real-time" }, { icon: Brain, text: "Analitik AI prediktif" }, { icon: Layout, text: "Semua dalam satu platform" }].map(f => (
                  <div key={f.text} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                      <f.icon size={14} className="text-[#8B5CF6]" />
                    </div>
                    <span className="text-xs text-[#C4C3D4]">{f.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right — Laptop mockup with floating cards */}
            <motion.div initial={{ opacity: 0, y: 50, rotateX: 10 }} whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true }} transition={{ duration: 1.2 }} className="lg:col-span-3 relative" style={{ perspective: "1200px" }}>

              {/* Main laptop frame */}
              <div className="relative rounded-2xl border border-white/[0.1] overflow-hidden"
                style={{ background: "#0A0A14", boxShadow: "0 0 80px rgba(139,92,246,0.12), 0 20px 60px rgba(0,0,0,0.5)" }}>
                {/* Browser bar */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
                  <div className="flex gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#EC4899]/50" /><span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/50" /><span className="w-2.5 h-2.5 rounded-full bg-[#4ADE80]/50" /></div>
                  <div className="flex-1 text-center"><span className="text-[9px] text-[#3A3B52] px-4 py-0.5 rounded-md bg-white/[0.03]">dashboard.gercep.ai</span></div>
                </div>
                {/* Dashboard content */}
                <div className="p-4">
                  {/* Top KPI row */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[{ l: "Omzet", v: "Rp 15.430.200", c: "#2DD4BF", ch: "+12%" }, { l: "Profit", v: "Rp 5.430.000", c: "#4ADE80", ch: "+8%" }, { l: "Transaksi", v: "34.500", c: "#38BDF8", ch: "+23%" }, { l: "Produk", v: "847", c: "#A78BFA", ch: "+5" }].map(k => (
                      <div key={k.l} className="rounded-lg border border-white/[0.06] p-2" style={{ background: "#0D0D1A" }}>
                        <p className="text-[7px] uppercase text-[#5A5B7A]">{k.l}</p>
                        <p className="text-[10px] font-bold" style={{ color: k.c, fontFamily: "'JetBrains Mono', monospace" }}>{k.v}</p>
                        <p className="text-[7px] text-[#4ADE80]">{k.ch}</p>
                      </div>
                    ))}
                  </div>
                  {/* Chart + sidebar */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 rounded-lg border border-white/[0.06] p-3" style={{ background: "#0D0D1A" }}>
                      <p className="text-[8px] uppercase text-[#5A5B7A] mb-2">Revenue Trend</p>
                      <div className="flex items-end gap-[3px] h-[70px]">
                        {[30, 45, 35, 55, 48, 65, 58, 72, 68, 80, 75, 85, 78, 92, 88].map((h, i) => (
                          <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: `linear-gradient(180deg, #2DD4BF, #8B5CF6)`, opacity: 0.5 + i / 30 }} />
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] p-3" style={{ background: "#0D0D1A" }}>
                      <p className="text-[8px] uppercase text-[#5A5B7A] mb-2">Top Produk</p>
                      {["Skincare Set", "Masker Wajah", "Serum Vit C"].map((p, i) => (
                        <div key={p} className="flex items-center justify-between mb-1.5">
                          <span className="text-[7px] text-[#8B8AA0]">{p}</span>
                          <div className="w-12 h-1 rounded-full bg-white/[0.06]">
                            <div className="h-full rounded-full" style={{ width: `${90 - i * 20}%`, background: ["#2DD4BF", "#8B5CF6", "#EC4899"][i] }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating cards around laptop */}
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="absolute -top-4 -right-4 sm:right-0 rounded-xl border p-3 w-[160px] z-10"
                style={{ borderColor: "rgba(249,115,22,0.2)", background: "rgba(13,13,26,0.9)", backdropFilter: "blur(15px)", boxShadow: "0 0 25px rgba(249,115,22,0.08)" }}>
                <p className="text-[8px] uppercase text-[#5A5B7A] mb-1">Marketplace</p>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-bold text-[#F97316]">Shopee</span>
                  <span className="text-[9px] font-bold text-[#EC4899]">TikTok</span>
                </div>
                <span className="text-[9px] font-bold text-[#22C55E]">Tokopedia</span>
              </motion.div>

              <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="absolute -bottom-3 -right-2 sm:right-4 rounded-xl border p-3 w-[170px] z-10"
                style={{ borderColor: "rgba(45,212,191,0.2)", background: "rgba(13,13,26,0.9)", backdropFilter: "blur(15px)", boxShadow: "0 0 25px rgba(45,212,191,0.08)" }}>
                <p className="text-[8px] uppercase text-[#5A5B7A] mb-1">AI Assistant</p>
                <p className="text-[8px] text-[#8B8AA0] italic">&quot;Apa yang bisa saya bantu? Mau lihat laporan hari ini?&quot;</p>
              </motion.div>

              <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
                className="absolute top-1/3 -left-4 sm:-left-8 rounded-xl border p-3 w-[140px] z-10"
                style={{ borderColor: "rgba(139,92,246,0.2)", background: "rgba(13,13,26,0.9)", backdropFilter: "blur(15px)", boxShadow: "0 0 25px rgba(139,92,246,0.08)" }}>
                <p className="text-[8px] uppercase text-[#5A5B7A] mb-1">Profit Bulan Ini</p>
                <p className="text-[12px] font-black text-[#4ADE80]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>+18.2%</p>
                <div className="flex gap-[2px] mt-1">
                  {[3, 5, 4, 7, 6, 8, 7].map((h, i) => <div key={i} className="flex-1 rounded-sm" style={{ height: h * 3, background: "#4ADE80", opacity: 0.4 + i / 14 }} />)}
                </div>
              </motion.div>

              {/* Glow behind laptop */}
              <div className="absolute -inset-8 rounded-3xl opacity-15 blur-3xl -z-10" style={{ background: "linear-gradient(135deg, #8B5CF6, #2DD4BF, #EC4899)" }} />
            </motion.div>
          </div>

          <p className="text-center text-[10px] text-[#3A3B52] mt-6 flex items-center justify-center gap-1.5">
            <span className="text-xs">🖱</span> Drag untuk memutar
          </p>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="py-20 px-6 relative">
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(rgba(45,212,191,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.15) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="max-w-[1000px] mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {STATS.map(s => (
              <motion.div key={s.label} variants={fadeUp}
                className="text-center rounded-2xl border p-6"
                style={{ borderColor: s.color + "20", background: "rgba(13,13,26,0.6)", backdropFilter: "blur(10px)", boxShadow: `0 0 30px ${s.color}08` }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl mx-auto mb-3"
                  style={{ background: s.color + "10", border: `1px solid ${s.color}20`, boxShadow: `0 0 15px ${s.color}10` }}>
                  <s.icon size={20} style={{ color: s.color }} />
                </div>
                <p className="text-3xl font-black mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", background: `linear-gradient(135deg, ${s.color}, #8B5CF6)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </p>
                <p className="text-[10px] text-[#5A5B7A] uppercase tracking-[0.1em] font-semibold">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-24 px-6" style={{ background: "#0A0A14" }}>
        <div className="max-w-[1100px] mx-auto">
          <div className="grid lg:grid-cols-5 gap-10 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="lg:col-span-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#EC4899] font-bold mb-3">CARA KERJA</p>
              <h2 className="text-3xl sm:text-4xl font-black leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                3 Langkah Mudah<br />Kelola Bisnismu dengan{" "}
                <span style={{ background: "linear-gradient(90deg, #EC4899, #8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI</span>
              </h2>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="lg:col-span-3 grid sm:grid-cols-3 gap-4 relative">
              {/* Connecting line behind cards */}
              <div className="hidden sm:block absolute top-[40px] left-[15%] right-[15%] h-[2px] z-0"
                style={{ background: "linear-gradient(90deg, #38BDF8, #8B5CF6, #2DD4BF)" }} />
              {STEPS.map((s) => (
                <motion.div key={s.num} variants={fadeUp} className="relative z-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full mx-auto mb-4 text-sm font-black"
                    style={{ background: s.color, color: "#070711", boxShadow: `0 0 25px ${s.color}40` }}>
                    {s.num}
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] p-5" style={{ background: "#0D0D1A" }}>
                    <h3 className="text-xs font-bold mb-2">{s.title}</h3>
                    <p className="text-[10px] text-[#8B8AA0] leading-relaxed">{s.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="harga" className="py-24 px-6">
        <div className="max-w-[1100px] mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-16">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#2DD4BF] font-bold mb-3">PAKET HEMAT</p>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <h2 className="text-3xl sm:text-4xl font-black leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Pilih Paket yang<br />Sesuai Kebutuhanmu
              </h2>
              <a href="/pricing" className="inline-flex items-center gap-2 text-xs text-[#2DD4BF] hover:underline font-medium">
                Lihat Semua Paket <ArrowRight size={12} />
              </a>
            </div>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map(p => (
              <motion.div key={p.name} variants={fadeUp}
                className={"relative rounded-2xl border p-6 transition-all hover:scale-[1.03] " + (p.popular ? "border-[#2DD4BF]/30" : "border-white/[0.06]")}
                style={{
                  background: p.popular ? "linear-gradient(180deg, rgba(13,13,26,1), rgba(10,30,30,1))" : "#0D0D1A",
                  boxShadow: p.popular ? "0 0 50px rgba(45,212,191,0.12)" : undefined,
                }}>
                {p.popular && (
                  <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full text-[8px] font-bold"
                    style={{ background: "linear-gradient(90deg, #EC4899, #8B5CF6)", color: "#fff" }}>
                    Populer!
                  </div>
                )}
                <p className="text-xs font-bold mb-3" style={{ color: p.color }}>{p.name}</p>
                <p className="mb-4">
                  <span className="text-xs text-[#5A5B7A]">Rp </span>
                  <span className="text-2xl font-black" style={{ fontFamily: "'JetBrains Mono', monospace", color: p.color }}>{p.price}</span>
                  <span className="text-xs text-[#5A5B7A]">{p.period}</span>
                </p>
                <div className="space-y-2 mb-6">
                  {p.features.map(f => (
                    <p key={f} className="flex items-center gap-2 text-[11px] text-[#8B8AA0]">
                      <Check size={11} style={{ color: p.color }} />{f}
                    </p>
                  ))}
                </div>
                <a href={p.name === "Enterprise" ? "https://wa.me/6281234567890" : `/signup?plan=${p.name.toLowerCase()}`}
                  className="block w-full text-center rounded-xl py-2.5 text-xs font-bold transition-all"
                  style={{
                    background: p.popular ? "linear-gradient(135deg, #2DD4BF, #8B5CF6)" : "transparent",
                    color: p.popular ? "#070711" : p.color,
                    border: p.popular ? "none" : `1px solid ${p.color}30`,
                    boxShadow: p.popular ? "0 0 20px rgba(45,212,191,0.2)" : undefined,
                  }}>
                  {p.cta}
                </a>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="relative py-32 px-6 overflow-hidden">
        {is3D && <Suspense fallback={null}><WaveScene /></Suspense>}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(45,212,191,0.06), transparent 50%), radial-gradient(ellipse at center bottom, rgba(139,92,246,0.06), transparent 40%)" }} />
        <div className="relative z-10 text-center max-w-[700px] mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-6 leading-[1.1]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Siap Upgrade Bisnismu ke{" "}
              <span style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6, #EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 15px rgba(139,92,246,0.3))" }}>
                Level Berikutnya?
              </span>
            </h2>
            <a href="/signup" className="group relative inline-flex items-center gap-3 px-10 py-4 rounded-2xl text-sm font-bold overflow-hidden"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711", boxShadow: "0 0 60px rgba(45,212,191,0.3), 0 0 120px rgba(139,92,246,0.15)" }}>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative">Mulai Sekarang, Gratis</span>
              <ArrowRight size={16} className="relative" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/[0.05] py-12 px-6" style={{ background: "#050508" }}>
        <div className="max-w-[1100px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold"
                  style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}>G</div>
                <span className="text-sm font-bold">GERCEP AI</span>
              </div>
              <p className="text-[10px] text-[#3A3B52] leading-relaxed max-w-[200px]">Solusi bisnis all-in-one dengan kecerdasan AI untuk UMKM Indonesia.</p>
            </div>
            {[
              { title: "Produk", links: ["Fitur", "Harga", "Integrasi", "AI Assistant"] },
              { title: "Company", links: ["Tentang Kami", "Blog", "Karir", "Kontak"] },
              { title: "Legal", links: ["Privacy Policy", "Terms of Service", "Kebijakan Data"] },
            ].map(col => (
              <div key={col.title}>
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#3A3B52] font-bold mb-3">{col.title}</p>
                <div className="space-y-2">
                  {col.links.map(l => <a key={l} href="#" className="block text-xs text-[#5A5B7A] hover:text-[#8B8AA0] transition-colors">{l}</a>)}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/[0.05] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[10px] text-[#3A3B52]">&copy; 2026 PT Henima Collection Indonesia. All rights reserved.</p>
            <div className="flex gap-4 text-[#3A3B52]">
              {[Globe, MessageCircle, Star].map((Icon, i) => (
                <a key={i} href="#" className="hover:text-[#8B8AA0] transition-colors"><Icon size={14} /></a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
