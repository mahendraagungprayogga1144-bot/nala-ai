"use client";
import { useState, useEffect, useRef, Suspense, lazy } from "react";
import { motion, useInView } from "framer-motion";
import { Wallet, ShoppingCart, Receipt, FileText, TrendingUp, Brain, Sparkles, Zap, ChevronDown, ArrowRight, Check, Globe, Shield, Clock } from "lucide-react";

const HeroScene = lazy(() => import("./components/home-3d/hero-scene"));
const WaveScene = lazy(() => import("./components/home-3d/wave-scene"));

function AnimatedCounter({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(target / 60);
    const interval = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(interval); }
      else setCount(start);
    }, 25);
    return () => clearInterval(interval);
  }, [inView, target]);

  return <span ref={ref} style={{ fontFamily: "'JetBrains Mono', monospace" }}>{prefix}{count.toLocaleString("id-ID")}{suffix}</span>;
}

const fadeUp = { hidden: { opacity: 0, y: 50 }, visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } } };
const fadeScale = { hidden: { opacity: 0, scale: 0.85 }, visible: { opacity: 1, scale: 1, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

const FEATURES = [
  { icon: Wallet, title: "Keuangan AI", desc: "Catat transaksi pakai bahasa biasa, AI yang hitung semuanya.", color: "#38BDF8" },
  { icon: ShoppingCart, title: "Marketplace Center", desc: "Analisis laporan Shopee, TikTok Shop, Tokopedia otomatis.", color: "#F97316" },
  { icon: Receipt, title: "AI Kasir", desc: "Kasir pintar universal untuk semua jenis toko.", color: "#2DD4BF" },
  { icon: FileText, title: "Pajak NPWP", desc: "Hitung PPh Final, PTKP, dan lapor pajak otomatis.", color: "#A78BFA" },
  { icon: TrendingUp, title: "Smart Profit", desc: "Tau untung bersih sebelum mulai jualan.", color: "#4ADE80" },
  { icon: Brain, title: "Insight AI", desc: "Rekomendasi bisnis cerdas langsung dari data kamu.", color: "#EC4899" },
];

const STEPS = [
  { num: "01", title: "Daftar & pilih jenis bisnis", desc: "Gratis, 30 detik, langsung pakai.", color: "#38BDF8" },
  { num: "02", title: "Input atau upload data", desc: "Ketik chat biasa atau upload CSV marketplace.", color: "#8B5CF6" },
  { num: "03", title: "AI kasih insight & kelola otomatis", desc: "Dashboard update, rekomendasi muncul, bisnis makin gercep.", color: "#2DD4BF" },
];

const PLANS = [
  { name: "Gratis", price: "0", color: "#8B8AA0", features: ["1 bisnis", "Keuangan basic", "Dashboard Owner"] },
  { name: "Starter", price: "40.000", color: "#38BDF8", features: ["2 bisnis", "Inventory 50 produk", "Kasir 100 transaksi"] },
  { name: "Pro", price: "75.000", color: "#2DD4BF", popular: true, features: ["5 bisnis", "Marketplace Center", "AI Kasir + Pajak"] },
  { name: "Enterprise", price: "150.000", color: "#A78BFA", features: ["Unlimited", "Multi user 10 akun", "API + White label"] },
];

const STATS = [
  { value: 1000, suffix: "+", label: "UMKM Terbantu", icon: Globe },
  { value: 50000, suffix: "+", label: "Transaksi Diproses", icon: Zap },
  { value: 99, suffix: ".9%", label: "Uptime System", icon: Shield },
  { value: 24, suffix: "/7", label: "AI Assistant", icon: Clock },
];

export default function Home() {
  const [is3D, setIs3D] = useState(false);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const isLowEnd = navigator.hardwareConcurrency ? navigator.hardwareConcurrency < 4 : false;
    setIs3D(!isMobile || !isLowEnd);
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden" style={{ background: "#070711", color: "#F2F1F8" }}>
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05]" style={{ background: "rgba(7,7,17,0.8)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}>G</div>
            <span className="text-sm font-bold">GERCEP <span style={{ background: "linear-gradient(90deg, #2DD4BF, #8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI</span></span>
          </div>
          <div className="hidden sm:flex items-center gap-8">
            <a href="#fitur" className="text-xs text-[#8B8AA0] hover:text-[#F0EFF8] transition-colors">Fitur</a>
            <a href="#pricing" className="text-xs text-[#8B8AA0] hover:text-[#F0EFF8] transition-colors">Harga</a>
            <a href="#tentang" className="text-xs text-[#8B8AA0] hover:text-[#F0EFF8] transition-colors">Tentang</a>
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-xs text-[#8B8AA0] hover:text-white transition-colors">Masuk</a>
            <a href="/signup" className="text-xs px-4 py-2 rounded-lg font-semibold"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}>Mulai Gratis</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {is3D && (
          <Suspense fallback={null}>
            <HeroScene />
          </Suspense>
        )}
        {!is3D && (
          <div className="absolute inset-0">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
              style={{ background: "conic-gradient(from 0deg, #2DD4BF, #8B5CF6, #EC4899, #2DD4BF)" }} />
          </div>
        )}

        {/* Scan lines overlay */}
        <div className="absolute inset-0 pointer-events-none z-[1] opacity-[0.03]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(45,212,191,0.1) 2px, rgba(45,212,191,0.1) 4px)", backgroundSize: "100% 4px" }} />

        <div className="relative z-10 text-center px-6 max-w-[850px] mx-auto">
          <motion.div initial={{ opacity: 0, scale: 0.8, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}>
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase text-[#2DD4BF] mb-10"
              style={{ border: "1px solid rgba(45,212,191,0.3)", background: "rgba(45,212,191,0.05)", boxShadow: "0 0 30px rgba(45,212,191,0.1), inset 0 0 30px rgba(45,212,191,0.03)" }}>
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2DD4BF] opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#2DD4BF]" /></span>
              AI-Powered Business OS
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-black leading-[1.0] tracking-[-0.02em] mb-8"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <span className="block">Business OS</span>
            <span className="block mt-2" style={{
              background: "linear-gradient(135deg, #2DD4BF 0%, #8B5CF6 40%, #EC4899 70%, #F59E0B 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 30px rgba(139,92,246,0.3))",
            }}>
              Masa Depan
            </span>
            <span className="block text-3xl sm:text-4xl md:text-5xl mt-3 font-semibold text-[#C4C3D4]">untuk UMKM Indonesia</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.8 }}
            className="text-base sm:text-lg text-[#8B8AA0] mb-12 max-w-[580px] mx-auto leading-relaxed">
            Kelola keuangan, inventory, kasir, marketplace, pajak —
            semua dengan kecerdasan AI dalam satu platform.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <a href="/signup" className="group relative flex items-center gap-2 px-10 py-4.5 rounded-2xl text-sm font-bold transition-all hover:scale-105 overflow-hidden"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711", boxShadow: "0 0 60px rgba(45,212,191,0.4), 0 0 120px rgba(139,92,246,0.2)" }}>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative">Mulai Gratis</span>
              <ArrowRight size={16} className="relative group-hover:translate-x-1 transition-transform" />
            </a>
            <a href="#fitur" className="flex items-center gap-2 px-10 py-4.5 rounded-2xl border text-sm text-[#8B8AA0] hover:text-white transition-all"
              style={{ borderColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(10px)", background: "rgba(255,255,255,0.02)" }}>
              Lihat Demo <ChevronDown size={14} />
            </a>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
            className="flex items-center justify-center gap-8 flex-wrap text-xs text-[#5A5B7A]">
            {["Gratis selamanya", "Tanpa kartu kredit", "Setup 30 detik"].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2DD4BF]/10"><Check size={9} className="text-[#2DD4BF]" /></span>{t}
              </span>
            ))}
          </motion.div>
        </div>

        <motion.div
          animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1">
          <span className="text-[9px] uppercase tracking-[0.2em] text-[#3A3B52]">Scroll</span>
          <ChevronDown size={16} className="text-[#3A3B52]" />
        </motion.div>
      </section>

      {/* FEATURES */}
      <section id="fitur" className="py-24 px-6">
        <div className="max-w-[1100px] mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}
            className="text-center mb-16">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#2DD4BF] font-semibold mb-3">FITUR UNGGULAN</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Semua yang bisnis kamu <span style={{ background: "linear-gradient(90deg, #2DD4BF, #8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>butuhkan</span>
            </h2>
            <p className="text-[#8B8AA0] max-w-[500px] mx-auto">Dari kasir sampai pajak, dikendalikan oleh AI.</p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <motion.div key={f.title} variants={fadeUp}
                className="group relative rounded-2xl border border-white/[0.06] p-7 cursor-default overflow-hidden"
                style={{ background: "#0D0D1A", transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.3s" }}
                onMouseMove={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left; const y = e.clientY - rect.top;
                  const cx = x / rect.width - 0.5; const cy = y / rect.height - 0.5;
                  e.currentTarget.style.transform = `perspective(600px) rotateY(${cx * 8}deg) rotateX(${-cy * 8}deg) scale(1.02)`;
                  e.currentTarget.style.borderColor = f.color + "40";
                  e.currentTarget.style.setProperty("--mx", `${x}px`);
                  e.currentTarget.style.setProperty("--my", `${y}px`);
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "perspective(600px) rotateY(0) rotateX(0) scale(1)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                }}>
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(400px circle at var(--mx, 50%) var(--my, 50%), ${f.color}15, transparent 60%)` }} />
                <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(90deg, transparent, ${f.color}, transparent)` }} />
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-5"
                    style={{ background: f.color + "10", border: `1px solid ${f.color}25`, boxShadow: `0 0 25px ${f.color}15` }}>
                    <f.icon size={22} style={{ color: f.color }} />
                  </div>
                  <h3 className="text-base font-bold mb-2">{f.title}</h3>
                  <p className="text-xs text-[#8B8AA0] leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 3D SHOWCASE */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse at center, #8B5CF620, transparent 70%)" }} />
        <div className="max-w-[1100px] mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#8B5CF6] font-semibold mb-3">DASHBOARD</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Dashboard Canggih dalam <span style={{ background: "linear-gradient(90deg, #8B5CF6, #EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>3D</span>
            </h2>
            <p className="text-[#8B8AA0] max-w-[500px] mx-auto text-sm">Semua data bisnis kamu, divisualisasikan real-time dengan antarmuka futuristik.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 80, rotateX: 25 }} whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
            viewport={{ once: true }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative mx-auto max-w-[950px]"
            style={{ perspective: "1200px" }}>
            <div className="rounded-3xl border border-white/[0.1] overflow-hidden"
              style={{ background: "#0D0D1A", boxShadow: "0 0 100px rgba(139,92,246,0.2), 0 0 60px rgba(45,212,191,0.15), 0 20px 80px rgba(0,0,0,0.5)" }}>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EC4899]/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4ADE80]/60" />
                </div>
                <span className="flex-1 text-center text-[10px] text-[#5A5B7A]">dashboard.gercep.ai</span>
              </div>
              <div className="p-6 grid grid-cols-4 gap-3">
                {[
                  { label: "Omzet", val: "Rp 126.430.000", color: "#2DD4BF" },
                  { label: "Transaksi", val: "12.458", color: "#38BDF8" },
                  { label: "Profit", val: "Rp 42.180.000", color: "#4ADE80" },
                  { label: "Produk", val: "847", color: "#A78BFA" },
                ].map(k => (
                  <div key={k.label} className="rounded-xl border border-white/[0.06] p-3" style={{ background: k.color + "08" }}>
                    <p className="text-[8px] uppercase text-[#5A5B7A] mb-1">{k.label}</p>
                    <p className="text-sm font-bold" style={{ color: k.color, fontFamily: "'JetBrains Mono', monospace" }}>{k.val}</p>
                  </div>
                ))}
              </div>
              <div className="px-6 pb-6 grid grid-cols-3 gap-3">
                <div className="col-span-2 rounded-xl border border-white/[0.06] p-4 h-[140px]" style={{ background: "#0A0A12" }}>
                  <p className="text-[9px] uppercase text-[#5A5B7A] mb-3">Revenue Trend</p>
                  <div className="flex items-end gap-1.5 h-[80px]">
                    {[35, 45, 30, 55, 70, 60, 80, 75, 90, 85, 95, 88].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: `linear-gradient(180deg, #2DD4BF, #8B5CF6)`, opacity: 0.7 + (i / 40) }} />
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-white/[0.06] p-4 h-[140px]" style={{ background: "#0A0A12" }}>
                  <p className="text-[9px] uppercase text-[#5A5B7A] mb-3">AI Insight</p>
                  <div className="space-y-2">
                    {["Stok Rendah: 3 item", "Margin naik 12%", "Trend: Positif"].map(t => (
                      <p key={t} className="text-[9px] text-[#8B8AA0] flex items-center gap-1">
                        <Sparkles size={8} className="text-[#2DD4BF]" />{t}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -inset-4 rounded-3xl opacity-20 blur-3xl -z-10"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6, #EC4899)" }} />
          </motion.div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-24 px-6 relative overflow-hidden" style={{ background: "#0A0A14" }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #2DD4BF15, transparent 50%), radial-gradient(circle at 80% 50%, #8B5CF615, transparent 50%)" }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(rgba(45,212,191,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="max-w-[1000px] mx-auto relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(s => (
              <motion.div key={s.label} variants={fadeUp}
                className="text-center rounded-2xl border border-white/[0.06] py-8 px-4"
                style={{ background: "rgba(13,13,26,0.6)", backdropFilter: "blur(10px)" }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl mx-auto mb-4"
                  style={{ background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.15)", boxShadow: "0 0 20px rgba(45,212,191,0.1)" }}>
                  <s.icon size={20} className="text-[#2DD4BF]" />
                </div>
                <p className="text-3xl sm:text-4xl font-black mb-2" style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6, #EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 10px rgba(45,212,191,0.3))" }}>
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </p>
                <p className="text-[10px] text-[#5A5B7A] uppercase tracking-[0.15em] font-semibold">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="tentang" className="py-24 px-6">
        <div className="max-w-[900px] mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#EC4899] font-semibold mb-3">CARA KERJA</p>
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              3 Langkah Mudah<br />Kelola Bisnismu dengan <span style={{ background: "linear-gradient(90deg, #EC4899, #8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI</span>
            </h2>
          </motion.div>

          <div className="relative">
            <div className="absolute left-6 sm:left-1/2 top-0 bottom-0 w-px sm:-translate-x-px" style={{ background: "linear-gradient(180deg, #2DD4BF, #8B5CF6, #EC4899)" }} />
            {STEPS.map((s, i) => (
              <motion.div key={s.num} initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: i * 0.15 }}
                className={"relative flex items-start gap-6 mb-12 " + (i % 2 === 0 ? "sm:flex-row" : "sm:flex-row-reverse")}
                style={{ paddingLeft: "3.5rem" }}>
                <div className="absolute left-3 sm:left-1/2 top-1 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold z-10"
                  style={{ background: s.color, color: "#070711", boxShadow: `0 0 20px ${s.color}60` }}>
                  {s.num}
                </div>
                <div className="sm:w-1/2 rounded-2xl border border-white/[0.06] p-5" style={{ background: "#0D0D1A" }}>
                  <h3 className="text-sm font-bold mb-1.5">{s.title}</h3>
                  <p className="text-xs text-[#8B8AA0] leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6" style={{ background: "#0A0A14" }}>
        <div className="max-w-[1100px] mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#2DD4BF] font-semibold mb-3">HARGA</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Pilih Paket yang Sesuai <span style={{ background: "linear-gradient(90deg, #2DD4BF, #8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Kebutuhanmu</span>
            </h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map(p => (
              <motion.div key={p.name} variants={fadeUp}
                className={"relative rounded-2xl border p-6 transition-all hover:scale-[1.02] " + (p.popular ? "border-[#2DD4BF]/30" : "border-white/[0.06]")}
                style={{
                  background: p.popular ? "linear-gradient(180deg, #0D0D1A, #0A1A1A)" : "#0D0D1A",
                  boxShadow: p.popular ? "0 0 40px rgba(45,212,191,0.1)" : undefined,
                }}>
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[9px] font-bold"
                    style={{ background: "linear-gradient(90deg, #2DD4BF, #8B5CF6)", color: "#070711" }}>
                    PALING POPULER
                  </div>
                )}
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: p.color }}>{p.name}</p>
                <p className="text-2xl font-bold mb-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  <span className="text-sm text-[#5A5B7A]">Rp</span>{p.price}<span className="text-xs text-[#5A5B7A]">/bln</span>
                </p>
                <div className="space-y-2 mb-6">
                  {p.features.map(f => (
                    <p key={f} className="flex items-center gap-2 text-xs text-[#8B8AA0]">
                      <Check size={12} style={{ color: p.color }} />{f}
                    </p>
                  ))}
                </div>
                <a href={p.name === "Enterprise" ? "https://wa.me/6281234567890" : `/signup?plan=${p.name.toLowerCase()}`}
                  className="block w-full text-center rounded-xl py-2.5 text-xs font-bold transition-all"
                  style={{
                    background: p.popular ? "linear-gradient(135deg, #2DD4BF, #8B5CF6)" : p.color + "15",
                    color: p.popular ? "#070711" : p.color,
                    border: p.popular ? "none" : `1px solid ${p.color}30`,
                  }}>
                  {p.name === "Gratis" ? "Mulai Gratis" : p.name === "Enterprise" ? "Hubungi Kami" : "Pilih " + p.name}
                </a>
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="text-center mt-8">
            <a href="/pricing" className="inline-flex items-center gap-2 text-sm text-[#2DD4BF] hover:underline">
              Lihat Semua Paket & Perbandingan <ArrowRight size={14} />
            </a>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-36 px-6 overflow-hidden">
        {is3D && (
          <Suspense fallback={null}>
            <WaveScene />
          </Suspense>
        )}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(45,212,191,0.08), transparent 60%), radial-gradient(ellipse at center bottom, rgba(139,92,246,0.08), transparent 50%)" }} />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(45,212,191,0.15) 2px, rgba(45,212,191,0.15) 4px)", backgroundSize: "100% 4px" }} />
        <div className="relative z-10 text-center max-w-[750px] mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#2DD4BF] font-bold mb-6">READY TO LEVEL UP?</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-8 leading-[1.05]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Siap Upgrade Bisnismu ke{" "}
              <span className="block sm:inline" style={{ background: "linear-gradient(135deg, #2DD4BF 0%, #8B5CF6 40%, #EC4899 80%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 20px rgba(139,92,246,0.4))" }}>
                Level Berikutnya?
              </span>
            </h2>
            <p className="text-[#8B8AA0] mb-12 max-w-[500px] mx-auto leading-relaxed">Gabung ribuan UMKM yang sudah merasakan kekuatan AI untuk bisnis mereka.</p>
            <a href="/signup" className="group relative inline-flex items-center gap-3 px-12 py-5 rounded-2xl text-base font-bold transition-all hover:scale-105 overflow-hidden"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711", boxShadow: "0 0 80px rgba(45,212,191,0.4), 0 0 160px rgba(139,92,246,0.2), 0 0 240px rgba(236,72,153,0.1)" }}>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <span className="relative">Mulai Sekarang, Gratis</span>
              <ArrowRight size={18} className="relative group-hover:translate-x-1 transition-transform" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.05] py-10 px-6" style={{ background: "#050508" }}>
        <div className="max-w-[1100px] mx-auto">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold"
                  style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}>G</div>
                <span className="text-sm font-bold">GERCEP AI</span>
              </div>
              <p className="text-xs text-[#5A5B7A] max-w-[280px]">Business OS masa depan untuk UMKM Indonesia. Powered by AI.</p>
            </div>
            <div className="flex gap-10 text-xs text-[#5A5B7A]">
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-[#3A3B52] font-semibold">Produk</p>
                <a href="#fitur" className="block hover:text-[#8B8AA0]">Fitur</a>
                <a href="/pricing" className="block hover:text-[#8B8AA0]">Harga</a>
                <a href="/signup" className="block hover:text-[#8B8AA0]">Daftar</a>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-[#3A3B52] font-semibold">Legal</p>
                <a href="#" className="block hover:text-[#8B8AA0]">Syarat & Ketentuan</a>
                <a href="#" className="block hover:text-[#8B8AA0]">Privasi</a>
                <a href="https://wa.me/6281234567890" target="_blank" rel="noopener noreferrer" className="block hover:text-[#8B8AA0]">Kontak</a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.05] pt-6 text-center">
            <p className="text-[10px] text-[#3A3B52]">&copy; 2026 PT Henima Collection Indonesia. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
