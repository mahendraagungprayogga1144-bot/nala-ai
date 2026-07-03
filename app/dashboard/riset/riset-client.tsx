"use client";
import Link from "next/link";
import { BarChart3, ArrowRight } from "lucide-react";
import ModuleHeader from "../components/module-header";

const PROMPTS = [
  { q: "Tren produk apa yang lagi naik di pasar kuliner UMKM?", tag: "Tren pasar" },
  { q: "Bandingkan margin bisnis kuliner vs retail untuk modal 10 juta", tag: "Kompetitor" },
  { q: "Peluang usaha apa yang cocok di daerah padat mahasiswa?", tag: "Peluang" },
  { q: "Berapa omzet hari ini dan menu apa yang paling laris?", tag: "Data kasir" },
  { q: "Strategi naikin omzet 20% bulan depan untuk warung saya", tag: "Strategi" },
];

export default function RisetClient({ businessName }: { businessName: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader icon={BarChart3} title="AI Riset Bisnis" subtitle={businessName} status="beta" />

      <p className="mb-6 text-sm text-[#8B8AA0]">
        Pilih topik riset — Gercep Chat akan jawab pakai data bisnis kamu + analisis AI.
      </p>

      <div className="flex flex-col gap-3">
        {PROMPTS.map(p => (
          <Link
            key={p.q}
            href={`/dashboard/chat?q=${encodeURIComponent(p.q)}`}
            className="group flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-4 transition-colors hover:border-[#2DD4BF]/30"
          >
            <div>
              <span className="mb-1 inline-block rounded-md bg-[#8B5CF6]/15 px-2 py-0.5 text-[9px] font-medium text-[#A78BFA]">{p.tag}</span>
              <p className="text-sm text-[#F0EFF8]">{p.q}</p>
            </div>
            <ArrowRight size={16} className="shrink-0 text-[#5A5B7A] transition-colors group-hover:text-[#2DD4BF]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
