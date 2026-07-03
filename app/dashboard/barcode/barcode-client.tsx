"use client";
import { useMemo, useState } from "react";
import { QrCode, Search } from "lucide-react";
import ModuleHeader from "../components/module-header";

type Product = { id: string; name: string; sku: string | null; stock: number; price: number | null; category: string | null };

export default function BarcodeClient({ businessName, products }: { businessName: string; products: Product[] }) {
  const [query, setQuery] = useState("");

  const result = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return products.find(p =>
      (p.sku || "").toLowerCase() === q ||
      (p.sku || "").toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q),
    ) || null;
  }, [query, products]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader
        icon={QrCode}
        title="Barcode QR Analyzer"
        subtitle={businessName}
        status="beta"
      />

      <div className="mb-6 rounded-2xl border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 p-4 text-xs text-[#8B8AA0]">
        Ketik atau scan SKU/barcode produk. Data diambil dari Inventory aktif.
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5B7A]" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="SKU-001 atau nama produk..."
          className="w-full rounded-xl border border-white/10 bg-[#0A0A12] py-3 pl-10 pr-4 text-sm text-[#F0EFF8] placeholder:text-[#5A5B7A] focus:border-[#2DD4BF]/50 focus:outline-none"
        />
      </div>

      {query && !result && (
        <p className="text-center text-sm text-[#8B8AA0]">Produk tidak ditemukan di inventory.</p>
      )}

      {result && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-5">
          <p className="text-lg font-semibold">{result.name}</p>
          <p className="mt-1 font-mono text-sm text-[#2DD4BF]">{result.sku || "Tanpa SKU"}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-[#8B8AA0]">Stok</span><p className="font-mono font-semibold">{result.stock}</p></div>
            <div><span className="text-[#8B8AA0]">Kategori</span><p>{result.category || "—"}</p></div>
            <div><span className="text-[#8B8AA0]">Harga jual</span><p className="font-mono">{result.price ? `Rp${result.price.toLocaleString("id-ID")}` : "—"}</p></div>
            <div><span className="text-[#8B8AA0]">Status</span><p className={result.stock > 0 ? "text-[#2DD4BF]" : "text-[#EC4899]"}>{result.stock > 0 ? "Tersedia" : "Habis"}</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
