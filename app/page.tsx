"use client";
import { motion } from "framer-motion";
import { MessageSquare, BarChart3, Package, Users, ShoppingBag, Megaphone, Brain, CreditCard, FlaskConical, ArrowRight, Check, TrendingUp, Zap, Globe, Shield } from "lucide-react";
import { useState } from "react";

const modules = [
  { icon: MessageSquare, name: "NALA Chat", desc: "Chat seperti biasa. AI yang catat, hitung, dan jawab pertanyaan bisnis kamu.", bg: "#10b98115", text: "#10b981", glow: "#10b981" },
  { icon: BarChart3, name: "Business Finance", desc: "Omzet, profit, margin, dan cashflow real-time tanpa input manual.", bg: "#3b82f615", text: "#3b82f6", glow: "#3b82f6" },
  { icon: Package, name: "Inventory", desc: "Stok otomatis berkurang setiap penjualan. HPP dan reorder point otomatis.", bg: "#f9731615", text: "#f97316", glow: "#f97316" },
  { icon: Users, name: "CRM", desc: "Database pelanggan, segmentasi, dan riwayat transaksi terhubung.", bg: "#a855f715", text: "#a855f7", glow: "#a855f7" },
  { icon: ShoppingBag, name: "Marketplace Center", desc: "Tokopedia, Shopee, TikTok Shop kelola pesanan di satu tempat.", bg: "#ec489915", text: "#ec4899", glow: "#ec4899" },
  { icon: Megaphone, name: "AI Marketing", desc: "Caption, iklan, dan strategi konten otomatis disesuaikan brand kamu.", bg: "#eab30815", text: "#eab308", glow: "#eab308" },
  { icon: Brain, name: "AI Research", desc: "Tren pasar, kompetitor, dan peluang usaha langsung dari AI.", bg: "#06b6d415", text: "#06b6d4", glow: "#06b6d4" },
  { icon: CreditCard, name: "AI Kasir", desc: "Kasir UMKM lengkap dengan struk, rekap kas, dan shift otomatis.", bg: "#22c55e15", text: "#22c55e", glow: "#22c55e" },
  { icon: FlaskConical, name: "NALA R&D", desc: "Formulasi produk berbasis AI untuk brand parfum, skincare, dan kuliner.", bg: "#8b5cf615", text: "#8b5cf6", glow: "#8b5cf6" },
];

const features = [
  { icon: MessageSquare, title: "Cukup ngobrol", desc: "Tidak perlu belajar software baru. Ketik seperti chat biasa, NALA yang paham." },
  { icon: Zap, title: "Serba otomatis", desc: "Dari catat transaksi sampai laporan bulanan — semua berjalan sendiri." },
  { icon: Globe, title: "Multi platform", desc: "Web, WhatsApp, Telegram, dan Mobile App. Satu akun, semua terhubung." },
  { icon: BarChart3, title: "Insight real-time", desc: "Tanya kondisi bisnis kapan saja. NALA jawab dengan data aktual." },
  { icon: Shield, title: "Data aman", desc: "Enkripsi end-to-end. Data bisnis kamu hanya bisa diakses oleh kamu." },
  { icon: Users, title: "Multi bisnis", desc: "Kelola parfum, skincare, kuliner, dan toko retail dari satu dashboard." },
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [hoveredModule, setHoveredModule] = useState<number | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (email) setSubmitted(true); };

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #071a0d 0%, #041008 35%, #020805 60%, #071a0d 100%)", color: "white", overflowX: "hidden", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Animated background blobs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-20%", left: "30%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)", animation: "pulse 4s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)" }} />
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.1); opacity: 1; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(16,185,129,0.1); } 50% { box-shadow: 0 0 40px rgba(16,185,129,0.25); } }
        .btn-primary { transition: all 0.25s ease !important; }
        .btn-primary:hover { transform: translateY(-2px) scale(1.02) !important; box-shadow: 0 12px 40px rgba(16,185,129,0.35) !important; }
        .btn-primary:active { transform: scale(0.97) !important; }
        .btn-secondary:hover { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.2) !important; transform: translateY(-1px) !important; }
      `}</style>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, borderBottom: "1px solid rgba(16,185,129,0.08)", background: "rgba(4,10,6,0.8)", backdropFilter: "blur(24px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.png" alt="NALA AI" style={{ width: 34, height: 34, objectFit: "contain" }} />
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>NALA AI</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {["Fitur", "Modul", "Pricing"].map((t) => (
              <a key={t} href={`#${t.toLowerCase()}`} style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "white")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}>{t}</a>
            ))}
            <a href="/auth" className="btn-primary" style={{ background: "#10b981", color: "black", padding: "9px 20px", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 20px rgba(16,185,129,0.25)" }}>
              Mulai Gratis
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ paddingTop: 160, paddingBottom: 80, textAlign: "center", padding: "160px 24px 80px", position: "relative", zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.08)", color: "#10b981", fontSize: 12, fontWeight: 600, marginBottom: 36, backdropFilter: "blur(10px)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "pulse 2s infinite" }} />
            AI Business Operating System · Made in Indonesia 🇮🇩
          </div>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
          style={{ fontSize: "clamp(52px, 8vw, 96px)", fontWeight: 900, lineHeight: 1.0, letterSpacing: "-4px", marginBottom: 28 }}>
          Satu chat.<br />
          <span style={{ color: "#10b981", textShadow: "0 0 60px rgba(16,185,129,0.3)" }}>Seluruh bisnis</span><br />
          terhubung.
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          style={{ fontSize: 18, color: "rgba(255,255,255,0.45)", maxWidth: 600, margin: "0 auto 40px", lineHeight: 1.75 }}>
          Catat penjualan, kelola stok, hitung profit, jalankan marketing, dan analisis bisnis kamu — hanya dengan mengetik seperti chat biasa. Dirancang untuk UMKM, reseller, retail, hingga enterprise Indonesia.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          <a href="/auth" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 36px", borderRadius: 14, background: "#10b981", color: "black", fontWeight: 800, fontSize: 16, textDecoration: "none", boxShadow: "0 8px 32px rgba(16,185,129,0.35)", animation: "glow 3s ease-in-out infinite" }}>
            Mulai Kelola Bisnis Dengan AI <ArrowRight size={18} />
          </a>
          <a href="#modul" className="btn-secondary" style={{ padding: "16px 28px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)", fontSize: 15, textDecoration: "none", transition: "all 0.25s" }}>
            Lihat fitur
          </a>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 28, fontSize: 13, color: "rgba(255,255,255,0.3)", flexWrap: "wrap" }}>
          {["Gratis selamanya", "Tanpa kartu kredit", "Bahasa Indonesia natural"].map((t) => (
            <span key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={13} color="#10b981" />{t}</span>
          ))}
        </motion.div>
      </section>

      {/* DASHBOARD MOCKUP */}
      <section id="fitur" style={{ padding: "0 24px 100px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
            style={{ borderRadius: 24, border: "1px solid rgba(16,185,129,0.15)", background: "rgba(6,20,10,0.95)", overflow: "hidden", boxShadow: "0 0 0 1px rgba(16,185,129,0.05), 0 40px 120px rgba(0,0,0,0.6), 0 0 80px rgba(16,185,129,0.06)", animation: "float 6s ease-in-out infinite" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px", borderBottom: "1px solid rgba(16,185,129,0.06)", background: "rgba(4,13,7,0.9)" }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ef4444" }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#eab308" }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ marginLeft: 12, color: "rgba(255,255,255,0.2)", fontSize: 12 }}>nala.ai/dashboard</span>
              <span style={{ marginLeft: "auto", fontSize: 11, padding: "3px 12px", borderRadius: 100, background: "rgba(16,185,129,0.15)", color: "#10b981", fontWeight: 600 }}>● Live</span>
            </div>
            <div style={{ padding: 28 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                {[{ label: "Omzet hari ini", value: "Rp 4.280.000", change: "+12.4%" }, { label: "Profit bersih", value: "Rp 1.284.000", change: "+8.1%" }].map((s) => (
                  <div key={s.label} style={{ padding: 18, borderRadius: 16, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.1)" }}>
                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: "0 0 8px" }}>{s.label}</p>
                    <p style={{ color: "white", fontWeight: 700, fontSize: 24, margin: "0 0 6px" }}>{s.value}</p>
                    <p style={{ color: "#10b981", fontSize: 12, margin: 0, display: "flex", alignItems: "center", gap: 4 }}><TrendingUp size={12} /> {s.change}</p>
                  </div>
                ))}
              </div>
              <div style={{ padding: 18, borderRadius: 16, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.08)", marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: 0 }}>Penjualan 7 hari</p>
                  <p style={{ color: "#10b981", fontSize: 13, fontWeight: 600, margin: 0 }}>Rp 28.4jt</p>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 64 }}>
                  {[35, 58, 42, 75, 50, 88, 65].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 6, background: i === 5 ? "#10b981" : "rgba(16,185,129,0.2)", transition: "all 0.3s", boxShadow: i === 5 ? "0 0 12px rgba(16,185,129,0.4)" : "none" }} />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  {["Sen","Sel","Rab","Kam","Jum","Sab","Min"].map((d) => (
                    <span key={d} style={{ flex: 1, textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 10 }}>{d}</span>
                  ))}
                </div>
              </div>
              <div style={{ borderRadius: 16, border: "1px solid rgba(16,185,129,0.1)", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(16,185,129,0.06)", display: "flex", alignItems: "center", gap: 10, background: "rgba(4,13,7,0.6)" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px rgba(16,185,129,0.3)" }}>
                    <span style={{ color: "black", fontSize: 12, fontWeight: 700 }}>N</span>
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600 }}>NALA</span>
                  <span style={{ fontSize: 11, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "pulse 1.5s infinite" }} /> Online
                  </span>
                </div>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { role: "user", text: "Saya jual 10 parfum harga 150 ribu" },
                    { role: "nala", text: "✅ Transaksi berhasil. Omzet +Rp 1.500.000" },
                    { role: "user", text: "Profit bulan ini berapa?" },
                    { role: "nala", text: "Profit bersih Rp 14.180.000 — margin 30% 📈" },
                  ].map((msg, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "70%", padding: "10px 14px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.role === "user" ? "#10b981" : "rgba(16,185,129,0.07)", border: msg.role === "nala" ? "1px solid rgba(16,185,129,0.12)" : "none", color: msg.role === "user" ? "black" : "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: msg.role === "user" ? 600 : 400 }}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(16,185,129,0.06)", display: "flex", gap: 10, background: "rgba(4,13,7,0.4)" }}>
                  <input readOnly placeholder="Ketik ke NALA..." style={{ flex: 1, background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 13, outline: "none" }} />
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px rgba(16,185,129,0.3)" }}>
                    <ArrowRight size={14} color="black" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: "60px 24px 80px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, marginBottom: 14, letterSpacing: "-1.5px" }}>
              Kenapa <span style={{ color: "#10b981" }}>NALA AI?</span>
            </h2>
            <p style={{ color: "rgba(255,255,255,0.35)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>Dirancang khusus untuk cara kerja bisnis Indonesia.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {features.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                onMouseEnter={() => setHoveredFeature(i)} onMouseLeave={() => setHoveredFeature(null)}
                style={{ padding: 22, borderRadius: 18, border: `1px solid ${hoveredFeature === i ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.05)"}`, background: hoveredFeature === i ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.02)", transition: "all 0.25s ease", transform: hoveredFeature === i ? "translateY(-4px)" : "translateY(0)", boxShadow: hoveredFeature === i ? "0 12px 32px rgba(0,0,0,0.3), 0 0 20px rgba(16,185,129,0.08)" : "none", cursor: "pointer" }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, transition: "all 0.25s", boxShadow: hoveredFeature === i ? "0 0 16px rgba(16,185,129,0.2)" : "none" }}>
                  <f.icon size={20} color="#10b981" />
                </div>
                <h3 style={{ fontWeight: 600, color: "white", marginBottom: 8, fontSize: 15 }}>{f.title}</h3>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section id="modul" style={{ padding: "60px 24px 80px", background: "rgba(4,10,6,0.5)", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, marginBottom: 14, letterSpacing: "-1.5px" }}>
              Semua modul dalam <span style={{ color: "#10b981" }}>satu platform</span>
            </h2>
            <p style={{ color: "rgba(255,255,255,0.35)", maxWidth: 480, margin: "0 auto" }}>Dari kasir hingga R&D — semua dikendalikan lewat percakapan.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {modules.map((mod, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                onMouseEnter={() => setHoveredModule(i)} onMouseLeave={() => setHoveredModule(null)}
                style={{ padding: 22, borderRadius: 20, border: `1px solid ${hoveredModule === i ? mod.text + "35" : "rgba(255,255,255,0.05)"}`, background: hoveredModule === i ? mod.bg : "rgba(6,20,10,0.6)", transition: "all 0.25s ease", transform: hoveredModule === i ? "translateY(-6px) scale(1.01)" : "translateY(0) scale(1)", boxShadow: hoveredModule === i ? `0 16px 40px rgba(0,0,0,0.4), 0 0 24px ${mod.glow}15` : "none", cursor: "pointer" }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: mod.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, transition: "all 0.25s", boxShadow: hoveredModule === i ? `0 0 20px ${mod.glow}25` : "none" }}>
                  <mod.icon size={21} color={mod.text} />
                </div>
                <h3 style={{ fontWeight: 600, color: hoveredModule === i ? "white" : "rgba(255,255,255,0.85)", marginBottom: 8, fontSize: 15, transition: "color 0.2s" }}>{mod.name}</h3>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{mod.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WAITLIST */}
      <section id="waitlist" style={{ padding: "100px 24px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.08)", color: "#10b981", fontSize: 12, fontWeight: 600, marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "pulse 2s infinite" }} />
            Early Access · Terbatas
          </div>
          <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 800, marginBottom: 20, letterSpacing: "-1.5px" }}>
            Jadilah yang pertama<br /><span style={{ color: "#10b981" }}>pakai NALA AI</span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 40, lineHeight: 1.75, fontSize: 16 }}>
            Daftar sekarang dan dapatkan akses awal + diskon 50% lifetime untuk early adopters.
          </p>
          {submitted ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              style={{ padding: 28, borderRadius: 20, border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.08)", boxShadow: "0 0 40px rgba(16,185,129,0.1)" }}>
              <Check size={32} color="#10b981" style={{ margin: "0 auto 14px", display: "block" }} />
              <p style={{ color: "#10b981", fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>Berhasil! Kamu masuk daftar waitlist.</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: 0 }}>Kami akan menghubungi kamu segera.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email kamu..." required
                style={{ flex: 1, minWidth: 200, padding: "15px 20px", borderRadius: 14, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", color: "white", fontSize: 14, outline: "none" }} />
              <button type="submit" className="btn-primary" style={{ padding: "15px 28px", borderRadius: 14, background: "#10b981", color: "black", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(16,185,129,0.3)" }}>
                Gabung Waitlist
              </button>
            </form>
          )}
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginTop: 16 }}>Gratis selamanya · Tanpa kartu kredit · Bisa cancel kapan saja</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(16,185,129,0.06)", padding: "32px 24px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "black", fontWeight: 700, fontSize: 12 }}>N</span>
            </div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>NALA AI</span>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>by PT Henima Collection Indonesia</span>
          </div>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, margin: 0 }}>© 2025 NALA AI · Made with ❤️ in Indonesia 🇮🇩</p>
        </div>
      </footer>
    </main>
  );
}