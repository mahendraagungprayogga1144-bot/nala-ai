"use client";
import { useState } from "react";
import { Megaphone, Copy, MessageCircle } from "lucide-react";
import ModuleHeader from "../components/module-header";

const TEMPLATES = [
  "🔥 {produk} ready stock! Harga spesial hari ini Rp{harga}. Order sekarang — stok terbatas!",
  "Promo {produk}! Gratis ongkir area kota. DM atau WA untuk order cepat.",
  "Best seller minggu ini: {produk}. Fresh & berkualitas. Cocok buat {target}.",
];

export default function MarketingClient({ businessName }: { businessName: string }) {
  const [produk, setProduk] = useState("");
  const [harga, setHarga] = useState("");
  const [target, setTarget] = useState("keluarga");
  const [caption, setCaption] = useState("");

  const generate = (tpl: string) => {
    setCaption(
      tpl
        .replace("{produk}", produk || "produk kami")
        .replace("{harga}", harga ? Number(harga).toLocaleString("id-ID") : "XX")
        .replace("{target}", target),
    );
  };

  const copy = () => {
    if (caption) navigator.clipboard.writeText(caption);
  };

  const waShare = () => {
    if (!caption) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, "_blank");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader icon={Megaphone} title="AI Marketing" subtitle={businessName} status="beta" chatHint="Minta caption kreatif di Chat" />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <input value={produk} onChange={e => setProduk(e.target.value)} placeholder="Nama produk" className="rounded-xl border border-white/10 bg-[#0A0A12] px-3 py-2.5 text-sm focus:border-[#2DD4BF]/50 focus:outline-none" />
        <input value={harga} onChange={e => setHarga(e.target.value)} placeholder="Harga (Rp)" type="number" className="rounded-xl border border-white/10 bg-[#0A0A12] px-3 py-2.5 text-sm focus:border-[#2DD4BF]/50 focus:outline-none" />
        <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Target (keluarga...)" className="rounded-xl border border-white/10 bg-[#0A0A12] px-3 py-2.5 text-sm focus:border-[#2DD4BF]/50 focus:outline-none" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TEMPLATES.map((t, i) => (
          <button key={i} type="button" onClick={() => generate(t)} className="rounded-lg border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-3 py-1.5 text-xs text-[#A78BFA] hover:bg-[#8B5CF6]/15">
            Template {i + 1}
          </button>
        ))}
      </div>

      {caption && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{caption}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={copy} className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#8B8AA0] hover:text-white"><Copy size={12} /> Salin</button>
            <button type="button" onClick={waShare} className="flex items-center gap-1 rounded-lg border border-[#4ADE80]/30 bg-[#4ADE80]/10 px-3 py-1.5 text-xs text-[#4ADE80]"><MessageCircle size={12} /> Share WA</button>
          </div>
        </div>
      )}
    </div>
  );
}
