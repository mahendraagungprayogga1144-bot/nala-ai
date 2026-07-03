"use client";
import { useState } from "react";
import Link from "next/link";
import { MessageCircle, Wallet, Store, Calculator, FileText, Package, Receipt, QrCode, Camera, ShoppingCart, Megaphone, BarChart3, Users, LayoutDashboard, Layers, Percent, Smartphone, Check, Zap, CircleCheck } from "lucide-react";

const targetUsers = ["Pribadi", "Pelajar", "Karyawan", "Freelancer", "Reseller", "Dropshipper", "UMKM", "Toko Retail", "Online Seller", "Kasir", "Distributor", "Perusahaan"];

const categories = [
  { title: "Keuangan dan Pajak", items: [
    { icon: Wallet, name: "Keuangan Pribadi", desc: "Catat pemasukan-pengeluaran, target tabungan.", href: "/dashboard/keuangan-pribadi" },
    { icon: Store, name: "Keuangan Bisnis", desc: "Modal, HPP, hutang-piutang, gaji karyawan.", href: "/dashboard/keuangan-bisnis" },
    { icon: Calculator, name: "Smart Profit Calculator", desc: "Profit bersih sampai break even point.", href: "/dashboard/smart-profit" },
    { icon: FileText, name: "Pajak NPWP Center", desc: "Input NPWP & lapor omzet sendiri.", href: "/dashboard/pajak-npwp" },
  ]},
  { title: "Operasional Toko", items: [
    { icon: Package, name: "Inventory", desc: "Stok berkurang otomatis, notif kalau habis.", href: "/dashboard/inventory" },
    { icon: Receipt, name: "AI Kasir", desc: "Struk, rekap kas, tutup shift otomatis.", href: "/dashboard/ai-kasir" },
    { icon: QrCode, name: "Barcode QR Analyzer", desc: "Daftar barcode & SKU sendiri.", href: "/dashboard/barcode-qr" },
    { icon: Camera, name: "AI Jual Beli", desc: "Input listing jual/beli sendiri.", href: "/dashboard/ai-jual-beli" },
  ]},
  { title: "Marketplace dan Marketing", items: [
    { icon: ShoppingCart, name: "Marketplace Center", desc: "Daftar toko Shopee/Tokopedia sendiri.", href: "/dashboard/marketplace-center" },
    { icon: Megaphone, name: "AI Marketing", desc: "Simpan draft caption & kampanye.", href: "/dashboard/ai-marketing" },
    { icon: BarChart3, name: "AI Riset Bisnis", desc: "Catat temuan riset sendiri.", href: "/dashboard/ai-riset" },
    { icon: Users, name: "CRM Pelanggan", desc: "Database pelanggan perusahaan.", href: "/dashboard/crm-pelanggan" },
  ]},
  { title: "Platform dan Tim", items: [
    { icon: LayoutDashboard, name: "Dashboard Owner", desc: "Tanya kondisi bisnis, AI jawab lengkap.", href: "/dashboard/owner" },
    { icon: Layers, name: "Multi Bisnis", desc: "Skincare, fashion, kuliner satu akun.", href: "/dashboard/multi-bisnis" },
    { icon: Percent, name: "Tim dan Komisi Karyawan", desc: "Rekap penjualan per sales, hitung komisi.", href: "/dashboard/tim-komisi" },
    { icon: Smartphone, name: "Multi Platform", desc: "Website, WhatsApp Bot, Telegram Bot.", href: "/dashboard/multi-platform" },
  ]},
];

const faqs = [
  { q: "Data bisnis aku aman nggak?", a: "Aman, data kamu terenkripsi dan cuma kamu yang bisa akses. Nggak dibagiin ke pihak manapun." },
  { q: "Susah belajar makainya nggak?", a: "Nggak sama sekali, tinggal ketik kayak chat biasa. Nggak ada tombol ribet atau menu yang bikin bingung." },
  { q: "Beneran gratis?", a: "Iya, paket dasar gratis selamanya tanpa kartu kredit. Ada paket lanjutan buat fitur lebih lengkap nanti." },
  { q: "Bisa dipakai bareng tim atau karyawan?", a: "Bisa, ada modul Tim dan Komisi Karyawan buat ngatur akses dan rekap performa tiap orang." },
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-[#0A0A12] text-[#F2F1F8] overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0A0A12]/80 backdrop-blur-xl">
        <div className="max-w-[1152px] mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-semibold">Gercep<span className="holo-text">AI</span></span>
          <div className="flex items-center gap-4"><a href="/login" className="text-sm text-[#8B8AA0]">Masuk</a><a href="/signup" className="text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] text-[#0A0A12] font-medium">Coba Gratis</a></div>
        </div>
      </nav>

      <section className="relative pt-40 pb-16 px-6 overflow-hidden text-center">
        <div className="absolute w-72 h-72 rounded-full opacity-20 blur-[80px] -top-20 right-[10%] bg-gradient-to-br from-[#38BDF8] via-[#8B5CF6] to-[#EC4899]" style={{ animation: "driftGlow 9s ease-in-out infinite" }} />
        <div className="relative max-w-[672px] mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-[#2DD4BF] text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF] animate-pulse" />
            AI Business OS - Buatan Indonesia
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight tracking-tight mb-6">Bisnis gercep,<br />hasil <span className="holo-text">maksimal</span>.</h1>
          <p className="text-lg text-[#8B8AA0] mb-8 leading-relaxed">Satu chat buat catat transaksi, pantau cashflow, dan ambil keputusan, secepat dan setepat sistem premium, sesimpel ngobrol biasa.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <a href="#waitlist" className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] text-[#0A0A12] font-semibold">Coba Gratis Sekarang</a>
            <a href="#modul" className="px-6 py-3.5 rounded-xl border border-white/10 text-[#8B8AA0] text-sm font-medium">Lihat cara kerjanya</a>
          </div>
          <div className="flex items-center justify-center gap-6 flex-wrap text-xs text-[#8B8AA0]">
            <span className="flex items-center gap-1.5"><Check size={13} className="text-[#2DD4BF]" />Gratis selamanya</span>
            <span className="flex items-center gap-1.5"><Check size={13} className="text-[#2DD4BF]" />Tanpa kartu kredit</span>
            <span className="flex items-center gap-1.5"><Check size={13} className="text-[#2DD4BF]" />Bahasa Indonesia natural</span>
          </div>
        </div>
      </section>

      <section className="py-12 px-6 border-y border-white/5">
        <div className="max-w-[1024px] mx-auto">
          <p className="text-center text-xs text-[#8B8AA0] tracking-wide mb-6">BUAT SIAPA AJA</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {targetUsers.map((u) => (<span key={u} className="px-3.5 py-1.5 rounded-full border border-white/10 text-xs text-[#8B8AA0]">{u}</span>))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 border-b border-white/5">
        <div className="max-w-[896px] mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold text-center mb-12">Cara kerjanya</h2>
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-12 h-12 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/30 flex items-center justify-center mx-auto mb-3"><MessageCircle size={20} className="text-[#38BDF8]" /></div>
              <h3 className="font-medium mb-1.5">1. Chat aja</h3>
              <p className="text-sm text-[#8B8AA0] leading-relaxed">Ketik kayak chat ke temen, bebas pakai bahasa sehari-hari.</p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 flex items-center justify-center mx-auto mb-3"><Zap size={20} className="text-[#8B5CF6]" /></div>
              <h3 className="font-medium mb-1.5">2. AI proses</h3>
              <p className="text-sm text-[#8B8AA0] leading-relaxed">AI ngerti maksud kamu, langsung hitung dan susun datanya.</p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-[#2DD4BF]/10 border border-[#2DD4BF]/30 flex items-center justify-center mx-auto mb-3"><CircleCheck size={20} className="text-[#2DD4BF]" /></div>
              <h3 className="font-medium mb-1.5">3. Beres otomatis</h3>
              <p className="text-sm text-[#8B8AA0] leading-relaxed">Tercatat, dashboard update, nggak perlu input manual lagi.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="modul" className="py-20 px-6 bg-[#0F0F1A]">
        <div className="max-w-[1152px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">Semua urusan, <span className="holo-text">satu platform</span></h2>
            <p className="text-[#8B8AA0] max-w-[576px] mx-auto">Dari kasir sampai riset bisnis, semua dikendalikan lewat chat.</p>
          </div>

          <div className="bg-[#38BDF8]/5 border border-[#38BDF8]/25 rounded-2xl p-5 mb-10 flex items-center gap-4 max-w-[672px] mx-auto">
            <MessageCircle size={26} className="text-[#38BDF8] flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium">Gercep Chat</h3>
              <p className="text-sm text-[#8B8AA0]">Pusat kendali semua modul, tinggal ngetik kayak chat biasa.</p>
            </div>
            <Link href="/dashboard/chat" className="shrink-0 rounded-lg border border-[#38BDF8]/30 px-3 py-1.5 text-xs font-medium text-[#38BDF8] hover:bg-[#38BDF8]/10">
              Buka
            </Link>
          </div>

          {categories.map((cat) => (
            <div key={cat.title} className="mb-10">
              <p className="text-xs text-[#2DD4BF] font-medium tracking-wide mb-4">{cat.title.toUpperCase()}</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {cat.items.map((mod) => (
                  <Link key={mod.name} href={mod.href} className="block p-5 rounded-2xl border border-white/5 bg-[#0A0A12] hover:border-[#2DD4BF]/30 transition-all group">
                    <mod.icon size={20} className="text-[#8B8AA0] mb-3 group-hover:text-[#2DD4BF] transition-colors" />
                    <h3 className="font-medium text-sm mb-1.5">{mod.name}</h3>
                    <p className="text-[#8B8AA0] text-xs leading-relaxed">{mod.desc}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-[672px] mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold text-center mb-10">Pertanyaan umum</h2>
          <div className="flex flex-col gap-6">
            {faqs.map((f) => (
              <div key={f.q}>
                <h3 className="font-medium mb-1.5">{f.q}</h3>
                <p className="text-sm text-[#8B8AA0] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="waitlist" className="py-24 px-6 bg-[#0F0F1A]">
        <div className="max-w-[672px] mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">Jadi yang pertama coba <span className="holo-text">Gercep AI</span></h2>
          <p className="text-[#8B8AA0] mb-8">Daftar sekarang, dapat akses awal plus diskon lifetime buat early adopters.</p>
          {submitted ? (
            <p className="text-[#2DD4BF] font-medium">Sip, kamu udah masuk waitlist!</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-[448px] mx-auto">
              <input type="email" required placeholder="Email kamu" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 px-4 py-3 rounded-xl bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" />
              <button type="submit" className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] text-[#0A0A12] font-semibold">Gabung Waitlist</button>
            </form>
          )}
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-white/5 text-center text-[#8B8AA0] text-sm">2026 Gercep AI - Dibuat dengan bangga di Indonesia</footer>
    </main>
  );
}
