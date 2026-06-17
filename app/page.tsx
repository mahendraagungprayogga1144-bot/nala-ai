"use client";
import { motion } from "framer-motion";
import { MessageSquare, BarChart3, Package, Users, ShoppingBag, Megaphone, Brain, CreditCard, FlaskConical, ArrowRight, Check, TrendingUp } from "lucide-react";
import { useState } from "react";

const modules = [
  { icon: MessageSquare, name: "NALA Chat", desc: "Chat seperti biasa. AI yang catat, hitung, dan jawab pertanyaan bisnis kamu.", bg: "#10b98120", text: "#10b981" },
  { icon: BarChart3, name: "Business Finance", desc: "Omzet, profit, margin, dan cashflow real-time tanpa input manual.", bg: "#3b82f620", text: "#3b82f6" },
  { icon: Package, name: "Inventory", desc: "Stok otomatis berkurang setiap penjualan. HPP dan reorder point otomatis.", bg: "#f9731620", text: "#f97316" },
  { icon: Users, name: "CRM", desc: "Database pelanggan, segmentasi, dan riwayat transaksi terhubung.", bg: "#a855f720", text: "#a855f7" },
  { icon: ShoppingBag, name: "Marketplace Center", desc: "Tokopedia, Shopee, TikTok Shop kelola pesanan di satu tempat.", bg: "#ec489920", text: "#ec4899" },
  { icon: Megaphone, name: "AI Marketing", desc: "Caption, iklan, dan strategi konten otomatis disesuaikan brand kamu.", bg: "#eab30820", text: "#eab308" },
  { icon: Brain, name: "AI Research", desc: "Tren pasar, kompetitor, dan peluang usaha langsung dari AI.", bg: "#06b6d420", text: "#06b6d4" },
  { icon: CreditCard, name: "AI Kasir", desc: "Kasir UMKM lengkap dengan struk, rekap kas, dan shift otomatis.", bg: "#22c55e20", text: "#22c55e" },
  { icon: FlaskConical, name: "NALA R&D", desc: "Formulasi produk berbasis AI untuk brand parfum, skincare, dan kuliner.", bg: "#8b5cf620", text: "#8b5cf6" },
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (email) setSubmitted(true); };
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0a1a0f 0%, #061009 40%, #040d07 100%)", color: "white", overflowX: "hidden", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, borderBottom: "1px solid rgba(16,185,129,0.1)", background: "rgba(6,16,9,0.85)", backdropFilter: "blur(20px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "black", fontWeight: 700, fontSize: 14 }}>N</span>
            </div>
            <span style={{ fontWeight: 600, fontSize: 15 }}>NALA AI</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <a href="#fitur" style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, textDecoration: "none" }}>Fitur</a>
            <a href="#modul" style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, textDecoration: "none" }}>Modul</a>
            <a href="#waitlist" style={{ background: "#10b981", color: "black", padding: "8px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Daftar Gratis</a>
          </div>
        </div>
      </nav>

      <section style={{ paddingTop: 160, paddingBottom: 80, textAlign: "center", padding: "160px 24px 80px", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 800, height: 500, background: "radial-gradient(ellipse, rgba(16,185,129,0.12) 0%, transparent 65%)", pointerEvents: "none" }} />
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.08)", color: "#10b981", fontSize: 12, fontWeight: 500, marginBottom: 36 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            AI Business Operating System · Made in Indonesia
          </div>
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} style={{ fontSize: "clamp(48px, 8vw, 88px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-3px", marginBottom: 28 }}>
          Satu chat.<br /><span style={{ color: "#10b981" }}>Seluruh bisnis</span><br />terhubung.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} style={{ fontSize: 18, color: "rgba(255,255,255,0.5)", maxWidth: 600, margin: "0 auto 40px", lineHeight: 1.7 }}>
          Catat penjualan, kelola stok, hitung profit, jalankan marketing, dan analisis bisnis kamu — hanya dengan mengetik seperti chat biasa. Dirancang untuk UMKM, reseller, retail, hingga enterprise Indonesia.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          <a href="#waitlist" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 32px", borderRadius: 14, background: "#10b981", color: "black", fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
            Mulai Kelola Bisnis Dengan AI <ArrowRight size={18} />
          </a>
          <a href="#modul" style={{ padding: "15px 28px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.65)", fontSize: 15, textDecoration: "none" }}>
            Lihat fitur
          </a>
        </motion.div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 28, fontSize: 13, color: "rgba(255,255,255,0.35)", flexWrap: "wrap" }}>
          {["Gratis selamanya", "Tanpa kartu kredit", "Bahasa Indonesia natural"].map((t) => (
            <span key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={13} color="#10b981" />{t}</span>
          ))}
        </div>
      </section>

      <section id="fitur" style={{ padding: "0 24px 100px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
            style={{ borderRadius: 24, border: "1px solid rgba(16,185,129,0.15)", background: "rgba(6,20,10,0.9)", overflow: "hidden", boxShadow: "0 0 120px rgba(16,185,129,0.08), 0 40px 80px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px", borderBottom: "1px solid rgba(16,185,129,0.08)", background: "rgba(4,13,7,0.8)" }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(239,68,68,0.7)" }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(234,179,8,0.7)" }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(34,197,94,0.7)" }} />
              <span style={{ marginLeft: 12, color: "rgba(255,255,255,0.2)", fontSize: 12 }}>nala.ai/dashboard</span>
              <span style={{ marginLeft: "auto", fontSize: 11, padding: "3px 12px", borderRadius: 100, background: "rgba(16,185,129,0.15)", color: "#10b981", fontWeight: 500 }}>● Live</span>
            </div>
            <div style={{ padding: 28 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                {[{ label: "Omzet hari ini", value: "Rp 4.280.000", change: "+12.4%" }, { label: "Profit bersih", value: "Rp 1.284.000", change: "+8.1%" }].map((s) => (
                  <div key={s.label} style={{ padding: 18, borderRadius: 16, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.1)" }}>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8 }}>{s.label}</p>
                    <p style={{ color: "white", fontWeight: 700, fontSize: 24, marginBottom: 6 }}>{s.value}</p>
                    <p style={{ color: "#10b981", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><TrendingUp size={12} /> {s.change}</p>
                  </div>
                ))}
              </div>
              <div style={{ padding: 18, borderRadius: 16, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.1)", marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Penjualan 7 hari</p>
                  <p style={{ color: "#10b981", fontSize: 13, fontWeight: 600 }}>Rp 28.4jt</p>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 64 }}>
                  {[35, 58, 42, 75, 50, 88, 65].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 6, background: i === 5 ? "#10b981" : "rgba(16,185,129,0.25)", transition: "all 0.3s" }} />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  {["Sen","Sel","Rab","Kam","Jum","Sab","Min"].map((d) => (
                    <span key={d} style={{ flex: 1, textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 10 }}>{d}</span>
                  ))}
                </div>
              </div>
              <div style={{ borderRadius: 16, border: "1px solid rgba(16,185,129,0.1)", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(16,185,129,0.08)", display: "flex", alignItems: "center", gap: 10, background: "rgba(4,13,7,0.5)" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "black", fontSize: 12, fontWeight: 700 }}>N</span>
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600 }}>NALA</span>
                  <span style={{ fontSize: 11, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} /> Online · siap membantu
                  </span>
                </div>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ background: "#10b981", color: "black", padding: "10px 16px", borderRadius: "18px 18px 4px 18px", fontSize: 13, fontWeight: 600, maxWidth: "65%" }}>
                      Saya jual 10 parfum harga 150 ribu
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)", padding: "12px 16px", borderRadius: "18px 18px 18px 4px", fontSize: 13, color: "rgba(255,255,255,0.85)", maxWidth: "75%", lineHeight: 1.6 }}>
                      Transaksi berhasil dicatat.<br />Omzet bertambah <span style={{ color: "#10b981", fontWeight: 700 }}>Rp 1.500.000</span>. Stok parfum dikurangi 10.
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ background: "#10b981", color: "black", padding: "10px 16px", borderRadius: "18px 18px 4px 18px", fontSize: 13, fontWeight: 600, maxWidth: "65%" }}>
                      Profit bulan ini berapa?
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)", padding: "12px 16px", borderRadius: "18px 18px 18px 4px", fontSize: 13, color: "rgba(255,255,255,0.85)", maxWidth: "75%", lineHeight: 1.6 }}>
                      Profit bersih bulan ini <span style={{ color: "#10b981", fontWeight: 700 }}>Rp 14.180.000</span> dari 312 transaksi. Margin rata-rata <span style={{ color: "#10b981", fontWeight: 700 }}>30%</span> — naik 2.1% dibanding bulan lalu.
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 4 }}>
                    {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(16,185,129,0.4)", display: "inline-block" }} />)}
                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginLeft: 4 }}>NALA sedang menganalisis tren minggu ini...</span>
                  </div>
                </div>
                <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(16,185,129,0.08)", display: "flex", alignItems: "center", gap: 12, background: "rgba(4,13,7,0.5)" }}>
                  <input readOnly placeholder="Ketik di sini... contoh: pengeluaran iklan 500rb" style={{ flex: 1, background: "transparent", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 13, outline: "none" }} />
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <ArrowRight size={15} color="black" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="modul" style={{ padding: "60px 24px 100px", background: "rgba(4,10,6,0.8)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 800, marginBottom: 16, letterSpacing: "-1.5px" }}>
              Semua modul dalam <span style={{ color: "#10b981" }}>satu platform</span>
            </h2>
            <p style={{ color: "rgba(255,255,255,0.4)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
              Dari kasir hingga R&D — semua dikendalikan lewat percakapan.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {modules.map((mod, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                style={{ padding: 22, borderRadius: 20, border: "1px solid rgba(16,185,129,0.08)", background: "rgba(6,20,10,0.6)", cursor: "pointer" }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: mod.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <mod.icon size={20} color={mod.text} />
                </div>
                <h3 style={{ fontWeight: 600, color: "white", marginBottom: 8, fontSize: 15 }}>{mod.name}</h3>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6 }}>{mod.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="waitlist" style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.08)", color: "#10b981", fontSize: 12, fontWeight: 500, marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            Early Access · Terbatas
          </div>
          <h2 style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 800, marginBottom: 20, letterSpacing: "-1.5px" }}>
            Jadilah yang pertama<br /><span style={{ color: "#10b981" }}>pakai NALA AI</span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 40, lineHeight: 1.7, fontSize: 16 }}>
            Daftar sekarang dan dapatkan akses awal + diskon 50% lifetime untuk early adopters.
          </p>
          {submitted ? (
            <div style={{ padding: 28, borderRadius: 20, border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.08)" }}>
              <Check size={32} color="#10b981" style={{ margin: "0 auto 14px", display: "block" }} />
              <p style={{ color: "#10b981", fontWeight: 700, fontSize: 16 }}>Berhasil! Kamu masuk daftar waitlist.</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 6 }}>Kami akan menghubungi kamu segera.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email kamu..." required
                style={{ flex: 1, minWidth: 200, padding: "15px 20px", borderRadius: 14, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", color: "white", fontSize: 14, outline: "none" }} />
              <button type="submit" style={{ padding: "15px 28px", borderRadius: 14, background: "#10b981", color: "black", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}>
                Gabung Waitlist
              </button>
            </form>
          )}
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginTop: 16 }}>Gratis selamanya · Tanpa kartu kredit · Bisa cancel kapan saja</p>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid rgba(16,185,129,0.08)", padding: "32px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "black", fontWeight: 700, fontSize: 12 }}>N</span>
            </div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>NALA AI</span>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>by PT Henima Collection Indonesia</span>
          </div>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>2025 NALA AI · Made with love in Indonesia</p>
        </div>
      </footer>
    </main>
  );
}