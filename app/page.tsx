"use client";
import { useState, useEffect, useRef, Suspense, lazy } from "react";
import { motion, useInView } from "framer-motion";
import { Wallet, ShoppingCart, Receipt, FileText, TrendingUp, Brain, Sparkles, ChevronDown, ArrowRight, Check, Globe, Shield, Clock, Zap, Eye, Layout, MessageCircle, Star } from "lucide-react";

const HeroScene = lazy(() => import("./components/home-3d/hero-scene"));
const WaveScene = lazy(() => import("./components/home-3d/wave-scene"));
const BgParticles = lazy(() => import("./components/home-3d/bg-particles"));
const LaptopScene = lazy(() => import("./components/home-3d/laptop-scene"));

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

const STATS = [
  { value: 1000, suffix: "+", label: "UMKM Terbantu", icon: Globe, color: "#2DD4BF" },
  { value: 50000, suffix: "+", label: "Transaksi Diproses", icon: Zap, color: "#8B5CF6" },
  { value: 99, suffix: ".9%", label: "Uptime System", icon: Shield, color: "#EC4899" },
  { value: 24, suffix: "/7", label: "AI Assistant", icon: Clock, color: "#38BDF8" },
];

const PLANS = [
  { name: "Gratis", price: "0", period: "/bulan", color: "#8B8AA0", features: ["1 bisnis", "Keuangan basic", "Dashboard Owner basic"], cta: "Mulai Gratis" },
  { name: "Starter", price: "40.000", period: "/bulan", color: "#38BDF8", features: ["2 bisnis", "Inventory 50 produk", "Export Excel/PDF"], cta: "Pilih Starter" },
  { name: "Pro", price: "75.000", period: "/bulan", color: "#2DD4BF", popular: true, features: ["5 bisnis", "AI Kasir universal", "Marketplace Center"], cta: "Coba 7 Hari Gratis" },
  { name: "Enterprise", price: "150.000", period: "/bulan", color: "#A78BFA", features: ["Unlimited bisnis", "API access", "Dedicated support"], cta: "Hubungi Kami" },
];

function GlowDivider() {
  return <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(45,212,191,0.3), rgba(139,92,246,0.3), rgba(236,72,153,0.2), transparent)" }} />;
}

function NebulaBlob({ color, position, size = 500 }: { color: string; position: string; size?: number }) {
  return <div className="absolute pointer-events-none" style={{ [position.includes("top") ? "top" : "bottom"]: position.includes("top") ? "0" : "0", [position.includes("left") ? "left" : "right"]: "0", width: size, height: size, background: `radial-gradient(circle, ${color}, transparent 70%)`, filter: `blur(${size / 4}px)`, opacity: 0.12 }} />;
}

export default function Home() {
  const [is3D, setIs3D] = useState(false);
  useEffect(() => { setIs3D(true); }, []);

  return (
    <main className="min-h-screen overflow-x-hidden relative" style={{ background: "#050508", color: "#F2F1F8" }}>
      {/* ═══ FULL PAGE PARTICLE BACKGROUND ═══ */}
      {is3D && <Suspense fallback={null}><BgParticles /></Suspense>}

      {/* ═══ NAV ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: "rgba(5,5,8,0.6)", backdropFilter: "blur(25px)", borderBottom: "1px solid rgba(45,212,191,0.08)" }}>
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo-gercep.png" alt="Gercep AI" className="h-8 w-8 rounded-lg object-cover" style={{ boxShadow: "0 0 15px rgba(45,212,191,0.3)" }} />
            <span className="text-sm font-bold tracking-wide">GERCEP AI</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-xs text-[#8B8AA0]">
            {["Fitur", "Harga", "Blog", "Tentang", "Kontak"].map(l => (
              <a key={l} href={l === "Harga" ? "/pricing" : `#${l.toLowerCase()}`} className="hover:text-[#2DD4BF] transition-colors">{l}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-xs text-[#8B8AA0] hover:text-white transition-colors">Masuk</a>
            <a href="/signup" className="text-xs px-5 py-2.5 rounded-xl font-bold relative overflow-hidden group"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#050508", boxShadow: "0 0 25px rgba(45,212,191,0.3)" }}>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
              <span className="relative">Mulai Gratis</span>
            </a>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
        {is3D && <Suspense fallback={null}><HeroScene /></Suspense>}
        <NebulaBlob color="#2DD4BF" position="top-right" size={800} />
        <NebulaBlob color="#8B5CF6" position="bottom-left" size={600} />
        <NebulaBlob color="#EC4899" position="top-left" size={400} />

        <div className="relative z-10 max-w-[1200px] mx-auto px-6 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-bold tracking-[0.2em] uppercase text-[#2DD4BF] mb-8"
                style={{ border: "1px solid rgba(45,212,191,0.3)", background: "rgba(45,212,191,0.06)", boxShadow: "0 0 30px rgba(45,212,191,0.1)" }}>
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2DD4BF] opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#2DD4BF]" /></span>
                AI-Powered Business OS
              </span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 60, rotateX: 45 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.1, duration: 1.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.05] tracking-tight mb-6"
              style={{ fontFamily: "'Space Grotesk', sans-serif", transformPerspective: 900, ...heading3D }}>
              Business OS{" "}
              <span className="block" style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6, #EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 25px rgba(139,92,246,0.4))" }}>
                Masa Depan untuk
              </span>
              UMKM Indonesia
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.8 }}
              className="text-sm sm:text-base text-[#8B8AA0] mb-8 max-w-[480px] leading-relaxed">
              Kelola keuangan, inventory, kasir, marketplace, pajak — semua dengan kecerdasan AI dalam satu platform.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }} className="flex flex-wrap items-center gap-3 mb-8">
              <a href="/signup" className="group relative flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold overflow-hidden"
                style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#050508", boxShadow: "0 0 60px rgba(45,212,191,0.4), 0 0 120px rgba(139,92,246,0.15)" }}>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative">Mulai Gratis</span> <ArrowRight size={16} className="relative" />
              </a>
              <a href="#fitur" className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm text-[#8B8AA0] hover:text-white transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)" }}>
                Lihat Demo <Eye size={14} />
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

      {/* ═══ 3D DASHBOARD ═══ */}
      <section className="py-24 px-6 relative overflow-hidden">
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
                {is3D && <Suspense fallback={
                  <div className="flex items-center justify-center h-full text-xs text-[#3A3B52]">Loading 3D...</div>
                }><LaptopScene /></Suspense>}
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
            {PLANS.map(p => (
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
                <a href={p.name === "Enterprise" ? "https://wa.me/6281234567890" : `/signup?plan=${p.name.toLowerCase()}`}
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
        {is3D && <Suspense fallback={null}><WaveScene /></Suspense>}
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
              { title: "Produk", links: ["Fitur", "Harga", "Integrasi", "AI Assistant"] },
              { title: "Company", links: ["Tentang Kami", "Blog", "Karir", "Kontak"] },
              { title: "Legal", links: ["Privacy Policy", "Terms of Service", "Kebijakan Data"] },
            ].map(col => (
              <div key={col.title}>
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#3A3B52] font-bold mb-3">{col.title}</p>
                <div className="space-y-2">
                  {col.links.map(l => <a key={l} href="#" className="block text-xs text-[#5A5B7A] hover:text-[#2DD4BF] transition-colors">{l}</a>)}
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
