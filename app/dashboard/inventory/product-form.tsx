"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ImagePlus } from "lucide-react";
import type { BusinessConfig } from "./business-config";

export default function ProductForm({ userId, businessId, nextSkuNumber, config }: { userId: string; businessId?: string; nextSkuNumber: number; config: BusinessConfig }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [sku, setSku] = useState(`SKU-${String(nextSkuNumber).padStart(3, "0")}`);
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("5");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let photoUrl: string | null = null;
    if (photoFile) {
      const path = `${userId}/${Date.now()}-${photoFile.name}`;
      const { error: uploadError } = await supabase.storage.from("product-photos").upload(path, photoFile);
      if (uploadError) {
        // Foto gagal tidak membatalkan simpan produk — tapi beri tahu
        console.warn(uploadError.message);
      } else {
        const { data } = supabase.storage.from("product-photos").getPublicUrl(path);
        photoUrl = data.publicUrl;
      }
    }
    const finalCategory = category === "custom" ? "" : category;
    const { error } = await supabase.from("products").insert({
      user_id: userId,
      business_id: businessId,
      name,
      sku,
      category: finalCategory || null,
      photo_url: photoUrl,
      stock: Number(stock),
      min_stock: Number(minStock),
      price: price ? Number(price) : null,
      cost: cost ? Number(cost) : null,
    });
    setLoading(false);
    if (error) {
      alert("Gagal simpan produk: " + error.message);
      return;
    }
    setName(""); setSku(`SKU-${String(nextSkuNumber + 1).padStart(3, "0")}`); setStock(""); setPrice(""); setCost(""); setCategory(""); setPhotoFile(null); setPhotoPreview("");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
      <h2 className="font-medium mb-1">{config.tambahLabel}</h2>
      <label className="flex items-center gap-3 cursor-pointer">
        <div style={{ width: 56, height: 56, minWidth: 56, minHeight: 56, maxWidth: 56, maxHeight: 56, overflow: "hidden" }} className="rounded-lg bg-[#0A0A12] border border-white/10 flex items-center justify-center flex-shrink-0">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : <ImagePlus size={18} className="text-[#8B8AA0]" />}
        </div>
        <span className="text-xs text-[#8B8AA0]">{photoFile ? photoFile.name : "Upload foto (opsional)"}</span>
        <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }} />
      </label>

      <div className="grid grid-cols-[1fr_110px] gap-3">
        <input type="text" required placeholder={`Nama ${config.produkLabel.toLowerCase()}`} value={name} onChange={(e) => setName(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" />
        <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className="px-3 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#2DD4BF] font-mono text-xs focus:outline-none focus:border-[#2DD4BF]/50" />
      </div>

      <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] focus:outline-none focus:border-[#2DD4BF]/50">
        <option value="">Pilih kategori</option>
        {config.kategoriDefault.map((k) => <option key={k} value={k} className="bg-[#0A0A12]">{k}</option>)}
        <option value="custom">+ Ketik sendiri</option>
      </select>

      {category === "custom" && (
        <input type="text" placeholder="Ketik kategori kamu..." onChange={(e) => setCategory(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" />
      )}

      <div className="grid grid-cols-2 gap-3">
        <input type="number" required placeholder={`${config.stokLabel} awal`} value={stock} onChange={(e) => setStock(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" />
        <input type="number" placeholder={`${config.stokLabel} minimum`} value={minStock} onChange={(e) => setMinStock(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input type="number" placeholder="Harga jual" value={price} onChange={(e) => setPrice(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" />
        <input type="number" placeholder="Modal (HPP)" value={cost} onChange={(e) => setCost(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" />
      </div>

      <button type="submit" disabled={loading} className="py-2.5 rounded-lg bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] text-[#0A0A12] font-semibold disabled:opacity-50 mt-1">{loading ? "Menyimpan..." : `+ ${config.produkLabel}`}</button>
    </form>
  );
}
