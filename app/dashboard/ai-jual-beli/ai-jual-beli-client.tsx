"use client";
import { useMemo, useState } from "react";
import { Camera, TrendingUp, TrendingDown } from "lucide-react";
import ModuleHeader from "../components/module-header";

type Product = { id: string; name: string; price: number; cost: number; stock: number; category: string | null };

export default function AiJualBeliClient({ businessName, products }: { businessName: string; products: Product[] }) {
  const [selected, setSelected] = useState("");
  const [kondisi, setKondisi] = useState<"baru" | "bekas_bagus" | "bekas">("baru");

  const product = products.find(p => p.id === selected);
  const estimate = useMemo(() => {
    if (!product) return null;
    const base = product.price || product.cost * 1.4 || 0;
    const mul = kondisi === "baru" ? 1 : kondisi === "bekas_bagus" ? 0.75 : 0.55;
    const jual = Math.round(base * mul);
    const beli = Math.round(jual * 0.65);
    const margin = jual > 0 ? Math.round(((jual - (product.cost || beli * 0.5)) / jual) * 100) : 0;
    return { jual, beli, margin };
  }, [product, kondisi]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader
        icon={Camera}
        title="AI Jual Beli"
        subtitle={`${businessName} · estimasi dari data inventory`}
        status="beta"
        chatHint="Minta analisis harga pasar di Chat"
      />

      <label className="mb-4 block">
        <span className="mb-1 block text-xs text-[#8B8AA0]">Pilih produk</span>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#0A0A12] px-3 py-2.5 text-sm text-[#F0EFF8] focus:border-[#2DD4BF]/50 focus:outline-none"
        >
          <option value="">— Pilih dari inventory —</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name} (stok {p.stock})</option>
          ))}
        </select>
      </label>

      <div className="mb-6 flex gap-2">
        {([["baru", "Baru"], ["bekas_bagus", "Bekas bagus"], ["bekas", "Bekas"]] as const).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setKondisi(v)}
            className={"rounded-lg border px-3 py-1.5 text-xs font-medium " + (kondisi === v ? "border-[#2DD4BF]/50 bg-[#2DD4BF]/15 text-[#2DD4BF]" : "border-white/10 text-[#8B8AA0]")}
          >
            {l}
          </button>
        ))}
      </div>

      {estimate && product && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#2DD4BF]/25 bg-[#2DD4BF]/5 p-5">
            <div className="mb-2 flex items-center gap-2 text-[#2DD4BF]"><TrendingUp size={18} /> Harga jual disarankan</div>
            <p className="font-mono text-2xl font-bold">Rp{estimate.jual.toLocaleString("id-ID")}</p>
            <p className="mt-1 text-xs text-[#8B8AA0]">Margin estimasi ~{estimate.margin}%</p>
          </div>
          <div className="rounded-2xl border border-[#8B5CF6]/25 bg-[#8B5CF6]/5 p-5">
            <div className="mb-2 flex items-center gap-2 text-[#A78BFA]"><TrendingDown size={18} /> Harga beli / modal</div>
            <p className="font-mono text-2xl font-bold">Rp{estimate.beli.toLocaleString("id-ID")}</p>
            <p className="mt-1 text-xs text-[#8B8AA0]">HPP tercatat: Rp{(product.cost || 0).toLocaleString("id-ID")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
