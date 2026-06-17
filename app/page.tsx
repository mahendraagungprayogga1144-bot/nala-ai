"use client";
import { motion } from "framer-motion";
import { MessageSquare, BarChart3, Package, Users, ShoppingBag, Megaphone, Brain, CreditCard, FlaskConical, ArrowRight, Check, Zap, Globe, Shield } from "lucide-react";
import { useState } from "react";
const modules = [
  { icon: MessageSquare, name: "NALA Chat", desc: "Chat seperti biasa. AI yang catat, hitung, dan jawab pertanyaan bisnis kamu.", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  { icon: BarChart3, name: "Business Finance", desc: "Omzet, profit, margin, dan cashflow real-time tanpa input manual.", bg: "bg-blue-500/10", text: "text-blue-400" },
  { icon: Package, name: "Inventory", desc: "Stok otomatis berkurang setiap penjualan. HPP dan reorder point otomatis.", bg: "bg-orange-500/10", text: "text-orange-400" },
  { icon: Users, name: "CRM", desc: "Database pelanggan, segmentasi, dan riwayat transaksi terhubung.", bg: "bg-purple-500/10", text: "text-purple-400" },
  { icon: ShoppingBag, name: "Marketplace Center", desc: "Tokopedia, Shopee, TikTok Shop kelola pesanan di satu tempat.", bg: "bg-pink-500/10", text: "text-pink-400" },
  { icon: Megaphone, name: "AI Marketing", desc: "Caption, iklan, dan strategi konten otomatis disesuaikan brand kamu.", bg: "bg-yellow-500/10", text: "text-yellow-400" },
  { icon: Brain, name: "AI Research", desc: "Tren pasar, kompetitor, dan peluang usaha langsung dari AI.", bg: "bg-cyan-500/10", text: "text-cyan-400" },
  { icon: CreditCard, name: "AI Kasir", desc: "Kasir UMKM lengkap dengan struk, rekap kas, dan shift otomatis.", bg: "bg-green-500/10", text: "text-green-400" },
  { icon: FlaskConical, name: "NALA R&D", desc: "Formulasi produk berbasis AI untuk brand parfum, skincare, dan kuliner.", bg: "bg-violet-500/10", text: "text-violet-400" },
];
export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (email) setSubmitted(true); };
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center"><span className="text-black font-bold text-sm">N</span></div>
            <span className="font-semibold">NALA AI</span>
          </div>
          <a href="#waitlist" className="text-sm px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-medium transition-colors">Daftar Gratis</a>
        </div>
      </nav>
      <section className="pt-40 pb-24 px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          AI Business Operating System · Made in Indonesia
        </div>
        <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight mb-6">
          Satu chat. <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Seluruh bisnis</span><br />terhubung.
        </h1>
        <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">Catat penjualan, kelola stok, hitung profit, jalankan marketing — hanya dengan mengetik seperti chat biasa.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
          <a href="#waitlist" className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-all">Mulai Kelola Bisnis Dengan AI <ArrowRight size={16} /></a>
          <a href="#modul" className="px-6 py-3.5 rounded-xl border border-white/10 text-white/70 hover:text-white transition-all text-sm font-medium">Lihat fitur</a>
        </div>
        <div className="flex items-center justify-center gap-6 text-sm text-white/40">
          {["Gratis selamanya","Tanpa kartu kredit","Bahasa Indonesia natural"].map((t) => (<span key={t} className="flex items-center gap-1.5"><Check size={13} className="text-emerald-400" />{t}</span>))}
        </div>
      </section>
      <section id="modul" className="py-20 px-6 bg-[#050505]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Semua modul dalam <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">satu platform</span></h2>
            <p className="text-white/40 max-w-xl mx-auto">Dari kasir hingga R&D — semua dikendalikan lewat percakapan.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((mod, i) => (
              <div key={i} className="group p-5 rounded-2xl border border-white/5 bg-[#0D0D0D] hover:border-white/10 hover:bg-[#111111] transition-all">
                <div className={"w-10 h-10 rounded-xl flex items-center justify-center mb-4 " + mod.bg}><mod.icon size={20} className={mod.text} /></div>
                <h3 className="font-semibold text-white mb-1.5">{mod.name}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{mod.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="waitlist" className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Jadilah yang pertama<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">pakai NALA AI</span></h2>
          <p className="text-white/40 mb-10 leading-relaxed">Daftar sekarang dan dapatkan akses awal + diskon 50% lifetime untuk early adopters.</p>
          {submitted ? (
            <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
              <Check size={24} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-emerald-400 font-semibold">Berhasil! Kamu masuk daftar waitlist.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email kamu..." required className="flex-1 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 outline-none focus:border-emerald-500/50 transition-colors text-sm" />
              <button type="submit" className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-all text-sm whitespace-nowrap">Gabung Waitlist</button>
            </form>
          )}
        </div>
      </section>
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center"><span className="text-black font-bold text-xs">N</span></div>
            <span className="font-semibold text-sm">NALA AI</span>
            <span className="text-white/20 text-sm">by PT Henima Collection Indonesia</span>
          </div>
          <p className="text-white/20 text-sm">2025 NALA AI · Made with love in Indonesia</p>
        </div>
      </footer>
    </main>
  );
}