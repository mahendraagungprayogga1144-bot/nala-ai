"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Search, Trash2, Edit2, ImagePlus } from "lucide-react";
import type { Product, HarvestMeta } from "../lib/types";
import { HARVEST_CATEGORIES, HARVEST_UNITS, GRADE_OPTIONS, inputCls, cardCls, isHarvestCategory, fmtRp, daysBetween } from "../lib/constants";

type Props = {
  products: Product[];
  harvestMeta: HarvestMeta[];
  userId: string;
  businessId: string;
  compact?: boolean;
};

export default function HarvestModule({ products, harvestMeta, userId, businessId, compact }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const [fNama, setFNama] = useState("");
  const [fKategori, setFKategori] = useState(HARVEST_CATEGORIES[0]);
  const [fStok, setFStok] = useState("");
  const [fSatuan, setFSatuan] = useState("kg");
  const [fHarga, setFHarga] = useState("");
  const [fHpp, setFHpp] = useState("");
  const [fHargaPasar, setFHargaPasar] = useState("");
  const [fLuas, setFLuas] = useState("");
  const [fTanam, setFTanam] = useState("");
  const [fPanen, setFPanen] = useState("");
  const [fGrade, setFGrade] = useState("A");
  const [fLokasi, setFLokasi] = useState("");
  const [fCatatan, setFCatatan] = useState("");
  const [fMinStok, setFMinStok] = useState("5");

  const harvestProducts = products.filter(p => isHarvestCategory(p.category));
  const filtered = harvestProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const getMeta = (productId: string) => harvestMeta.find(m => m.product_id === productId);

  const reset = () => {
    setFNama(""); setFStok(""); setFHarga(""); setFHpp(""); setFHargaPasar(""); setFLuas("");
    setFTanam(""); setFPanen(""); setFLokasi(""); setFCatatan(""); setEditId(null);
    setPhotoFile(null); setPhotoPreview(""); setShowForm(false);
  };

  const openEdit = (p: Product) => {
    const m = getMeta(p.id);
    setEditId(p.id);
    setFNama(p.name);
    setFKategori(p.category || HARVEST_CATEGORIES[0]);
    setFStok(String(p.stock));
    setFSatuan(m?.satuan || "kg");
    setFHarga(p.price ? String(p.price) : "");
    setFHpp(p.cost ? String(p.cost) : "");
    setFHargaPasar(m?.harga_pasar ? String(m.harga_pasar) : "");
    setFLuas(m?.luas_lahan ? String(m.luas_lahan) : "");
    setFTanam(m?.tanggal_tanam || "");
    setFPanen(m?.tanggal_panen || "");
    setFGrade(m?.grade_kualitas || "A");
    setFLokasi(m?.lokasi_penyimpanan || "");
    setFCatatan(m?.catatan || "");
    setFMinStok(String(p.min_stock));
    setPhotoPreview(p.photo_url || "");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!fNama || !fStok) return;
    setLoading(true);
    let photoUrl: string | null = editId ? (products.find(p => p.id === editId)?.photo_url || null) : null;
    if (photoFile) {
      const path = `${userId}/${Date.now()}-${photoFile.name}`;
      const { error } = await supabase.storage.from("product-photos").upload(path, photoFile);
      if (!error) {
        const { data } = supabase.storage.from("product-photos").getPublicUrl(path);
        photoUrl = data.publicUrl;
      }
    }
    const lamaTanam = daysBetween(fTanam, fPanen);
    const productPayload = {
      user_id: userId, business_id: businessId, name: fNama, category: fKategori,
      stock: Number(fStok), min_stock: Number(fMinStok),
      price: fHarga ? Number(fHarga) : null, cost: fHpp ? Number(fHpp) : null, photo_url: photoUrl,
    };
    let productId = editId;
    if (editId) {
      const { error } = await supabase.from("products").update(productPayload).eq("id", editId);
      if (error) { setLoading(false); alert("Gagal simpan: " + error.message); return; }
    } else {
      const { data, error } = await supabase.from("products").insert(productPayload).select("id").single();
      if (error) { setLoading(false); alert("Gagal tambah: " + error.message); return; }
      productId = data?.id;
    }
    if (productId) {
      const metaPayload = {
        product_id: productId, user_id: userId, business_id: businessId,
        luas_lahan: fLuas ? Number(fLuas) : null,
        tanggal_tanam: fTanam || null, tanggal_panen: fPanen || null,
        lama_masa_tanam: lamaTanam, satuan: fSatuan,
        harga_pasar: fHargaPasar ? Number(fHargaPasar) : null,
        grade_kualitas: fGrade, lokasi_penyimpanan: fLokasi || null, catatan: fCatatan || null,
      };
      const existing = harvestMeta.find(m => m.product_id === productId);
      if (existing) {
        const { error } = await supabase.from("agri_harvest_meta").update(metaPayload).eq("id", existing.id);
        if (error) alert("Produk ok, meta gagal: " + error.message);
      } else {
        const { error } = await supabase.from("agri_harvest_meta").insert(metaPayload);
        if (error) alert("Produk ok, meta gagal: " + error.message);
      }
    }
    setLoading(false);
    reset();
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus komoditas panen ini?")) return;
    await supabase.from("agri_harvest_meta").delete().eq("product_id", id);
    await supabase.from("stock_movements").delete().eq("product_id", id);
    await supabase.from("products").delete().eq("id", id);
    router.refresh();
  };

  const totalPanen = harvestProducts.reduce((s, p) => s + p.stock, 0);
  const nilaiPanen = harvestProducts.reduce((s, p) => s + (p.price || 0) * p.stock, 0);
  const avgHarga = harvestProducts.length ? harvestProducts.reduce((s, p) => s + (p.price || 0), 0) / harvestProducts.length : 0;

  return (
    <div className="space-y-4">
      {!compact && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Panen", value: `${totalPanen} unit` },
              { label: "Nilai Panen", value: fmtRp(nilaiPanen) },
              { label: "Rata-rata Harga", value: fmtRp(avgHarga) },
              { label: "Total Komoditas", value: String(harvestProducts.length) },
            ].map(k => (
              <div key={k.label} className={`${cardCls} p-4`}>
                <p className="text-[10px] text-[#8B8AA0] mb-1">{k.label}</p>
                <p className="text-lg font-semibold font-mono">{k.value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5B7A]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari komoditas..."
                className={`${inputCls} pl-9`} />
            </div>
            <button type="button" onClick={() => { reset(); setShowForm(true); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white">
              <Plus size={14} /> Tambah Panen
            </button>
          </div>
        </>
      )}

      {showForm && !compact && (
        <div className={`${cardCls} p-5 fade-up`}>
          <h3 className="text-sm font-semibold mb-4">{editId ? "Edit" : "Tambah"} Hasil Panen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-3 cursor-pointer md:col-span-2">
              <div className="h-14 w-14 rounded-xl bg-[#0A0A12] border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {photoPreview ? <img src={photoPreview} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={18} className="text-[#8B8AA0]" />}
              </div>
              <span className="text-xs text-[#8B8AA0]">Foto Panen (opsional)</span>
              <input type="file" accept="image/*" className="sr-only" onChange={e => {
                const f = e.target.files?.[0];
                if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); }
              }} />
            </label>
            <input className={inputCls} placeholder="Nama Komoditas *" value={fNama} onChange={e => setFNama(e.target.value)} />
            <select className={inputCls} value={fKategori} onChange={e => setFKategori(e.target.value)}>
              {HARVEST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} type="number" placeholder="Jumlah Panen *" value={fStok} onChange={e => setFStok(e.target.value)} />
              <select className={inputCls} value={fSatuan} onChange={e => setFSatuan(e.target.value)}>
                {HARVEST_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <input className={inputCls} type="number" placeholder="Luas Lahan (ha)" value={fLuas} onChange={e => setFLuas(e.target.value)} />
            <input className={inputCls} type="date" value={fTanam} onChange={e => setFTanam(e.target.value)} />
            <input className={inputCls} type="date" value={fPanen} onChange={e => setFPanen(e.target.value)} />
            <input className={inputCls} type="number" placeholder="Harga Jual" value={fHarga} onChange={e => setFHarga(e.target.value)} />
            <input className={inputCls} type="number" placeholder="HPP per unit (Rp) — opsional" value={fHpp} onChange={e => setFHpp(e.target.value)} />
            <input className={inputCls} type="number" placeholder="Harga Pasar" value={fHargaPasar} onChange={e => setFHargaPasar(e.target.value)} />
            <select className={inputCls} value={fGrade} onChange={e => setFGrade(e.target.value)}>
              {GRADE_OPTIONS.map(g => <option key={g} value={g}>Grade {g}</option>)}
            </select>
            <input className={inputCls} placeholder="Lokasi Penyimpanan" value={fLokasi} onChange={e => setFLokasi(e.target.value)} />
            <input className={inputCls} type="number" placeholder="Stok minimum" value={fMinStok} onChange={e => setFMinStok(e.target.value)} />
            <textarea className={`${inputCls} md:col-span-2`} rows={2} placeholder="Catatan" value={fCatatan} onChange={e => setFCatatan(e.target.value)} />
          </div>
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={handleSave} disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white disabled:opacity-50">
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
            <button type="button" onClick={reset} className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-[#8B8AA0]">Batal</button>
          </div>
        </div>
      )}

      <div className={`${cardCls} overflow-hidden`}>
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#8B8AA0]">{compact ? "Belum ada data. Buka tab Catat untuk tambah." : "Belum ada hasil panen. Tambah komoditas pertama kamu."}</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filtered.map(p => {
              const m = getMeta(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors">
                  <div className="h-10 w-10 rounded-lg bg-[#0A0A12] border border-white/10 overflow-hidden flex-shrink-0">
                    {p.photo_url ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-[#5A5B7A]">🌾</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-[11px] text-[#8B8AA0]">
                      {p.category} · {p.stock} {m?.satuan || "kg"}
                      {m?.grade_kualitas ? ` · Grade ${m.grade_kualitas}` : ""}
                      {m?.lama_masa_tanam ? ` · ${m.lama_masa_tanam} hari` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-mono text-violet-300 flex-shrink-0">{fmtRp((p.price || 0) * p.stock)}</p>
                  <button type="button" onClick={() => openEdit(p)} className="p-1.5 text-[#8B8AA0] hover:text-violet-400"><Edit2 size={14} /></button>
                  <button type="button" onClick={() => handleDelete(p.id)} className="p-1.5 text-[#8B8AA0] hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
