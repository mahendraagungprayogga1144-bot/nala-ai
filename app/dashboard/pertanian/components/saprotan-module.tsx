"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Search, Trash2, Edit2, AlertTriangle } from "lucide-react";
import type { Product, SaprotanMeta } from "../lib/types";
import { SAPROTAN_CATEGORIES, SAPROTAN_UNITS, inputCls, cardCls, isSaprotanCategory, fmtRp } from "../lib/constants";

type Props = { products: Product[]; saprotanMeta: SaprotanMeta[]; userId: string; businessId: string; compact?: boolean };

export default function SaprotanModule({ products, saprotanMeta, userId, businessId, compact }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [fNama, setFNama] = useState("");
  const [fKategori, setFKategori] = useState(SAPROTAN_CATEGORIES[0]);
  const [fMerek, setFMerek] = useState("");
  const [fSupplier, setFSupplier] = useState("");
  const [fBeli, setFBeli] = useState("");
  const [fBeliDate, setFBeliDate] = useState("");
  const [fExp, setFExp] = useState("");
  const [fStok, setFStok] = useState("");
  const [fSatuan, setFSatuan] = useState("kg");
  const [fHarga, setFHarga] = useState("");
  const [fLokasi, setFLokasi] = useState("");
  const [fMinStok, setFMinStok] = useState("5");

  const saprotanProducts = products.filter(p => isSaprotanCategory(p.category));
  const filtered = saprotanProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const getMeta = (id: string) => saprotanMeta.find(m => m.product_id === id);

  const today = new Date();
  const alerts = saprotanProducts.flatMap(p => {
    const m = getMeta(p.id);
    const items: { type: string; msg: string }[] = [];
    if (p.stock <= p.min_stock) items.push({ type: "stok", msg: `${p.name} stok menipis (${p.stock})` });
    if (m?.tanggal_kadaluarsa) {
      const days = Math.ceil((new Date(m.tanggal_kadaluarsa).getTime() - today.getTime()) / 86400000);
      if (days <= 30 && days >= 0) items.push({ type: "exp", msg: `${p.name} kadaluarsa ${days} hari lagi` });
    }
    return items;
  });

  const reset = () => {
    setFNama(""); setFMerek(""); setFSupplier(""); setFBeli(""); setFBeliDate(""); setFExp("");
    setFStok(""); setFHarga(""); setFLokasi(""); setEditId(null); setShowForm(false);
  };

  const openEdit = (p: Product) => {
    const m = getMeta(p.id);
    setEditId(p.id); setFNama(p.name); setFKategori(p.category || SAPROTAN_CATEGORIES[0]);
    setFMerek(m?.merek || ""); setFSupplier(m?.supplier || "");
    setFBeli(p.cost ? String(p.cost) : ""); setFBeliDate(m?.tanggal_pembelian || "");
    setFExp(m?.tanggal_kadaluarsa || ""); setFStok(String(p.stock));
    setFSatuan(m?.satuan || "kg"); setFHarga(p.price ? String(p.price) : "");
    setFLokasi(m?.lokasi_penyimpanan || ""); setFMinStok(String(p.min_stock));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!fNama || !fStok) return;
    setLoading(true);
    const payload = {
      user_id: userId, business_id: businessId, name: fNama, category: fKategori,
      stock: Number(fStok), min_stock: Number(fMinStok),
      cost: fBeli ? Number(fBeli) : null, price: fHarga ? Number(fHarga) : null,
    };
    let productId = editId;
    if (editId) {
      const { error } = await supabase.from("products").update(payload).eq("id", editId);
      if (error) { setLoading(false); alert("Gagal simpan: " + error.message); return; }
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error) { setLoading(false); alert("Gagal tambah: " + error.message); return; }
      productId = data?.id;
    }
    if (productId) {
      const meta = {
        product_id: productId, user_id: userId, business_id: businessId,
        merek: fMerek || null, supplier: fSupplier || null,
        tanggal_pembelian: fBeliDate || null, tanggal_kadaluarsa: fExp || null,
        satuan: fSatuan, lokasi_penyimpanan: fLokasi || null,
      };
      const ex = saprotanMeta.find(m => m.product_id === productId);
      if (ex) {
        const { error } = await supabase.from("agri_saprotan_meta").update(meta).eq("id", ex.id);
        if (error) alert("Produk ok, meta gagal: " + error.message);
      } else {
        const { error } = await supabase.from("agri_saprotan_meta").insert(meta);
        if (error) alert("Produk ok, meta gagal: " + error.message);
      }
    }
    setLoading(false); reset(); router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus saprotan ini?")) return;
    await supabase.from("agri_saprotan_meta").delete().eq("product_id", id);
    await supabase.from("stock_movements").delete().eq("product_id", id);
    await supabase.from("products").delete().eq("id", id);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {!compact && alerts.length > 0 && (
        <div className={`${cardCls} p-4 border-amber-500/20`}>
          <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5"><AlertTriangle size={14} /> Alert Gercep Saprotan</p>
          <ul className="space-y-1">{alerts.map((a, i) => <li key={i} className="text-xs text-[#8B8AA0]">• {a.msg}</li>)}</ul>
        </div>
      )}

      {!compact && (
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5B7A]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari saprotan..." className={`${inputCls} pl-9`} />
        </div>
        <button type="button" onClick={() => { reset(); setShowForm(true); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white">
          <Plus size={14} /> Tambah Saprotan
        </button>
      </div>
      )}

      {showForm && !compact && (
        <div className={`${cardCls} p-5 fade-up`}>
          <h3 className="text-sm font-semibold mb-4">{editId ? "Edit" : "Tambah"} Saprotan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className={inputCls} placeholder="Nama Produk *" value={fNama} onChange={e => setFNama(e.target.value)} />
            <select className={inputCls} value={fKategori} onChange={e => setFKategori(e.target.value)}>
              {SAPROTAN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className={inputCls} placeholder="Merek" value={fMerek} onChange={e => setFMerek(e.target.value)} />
            <input className={inputCls} placeholder="Supplier" value={fSupplier} onChange={e => setFSupplier(e.target.value)} />
            <input className={inputCls} type="date" value={fBeliDate} onChange={e => setFBeliDate(e.target.value)} />
            <input className={inputCls} type="date" value={fExp} onChange={e => setFExp(e.target.value)} />
            <input className={inputCls} type="number" placeholder="Harga Beli" value={fBeli} onChange={e => setFBeli(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} type="number" placeholder="Stok *" value={fStok} onChange={e => setFStok(e.target.value)} />
              <select className={inputCls} value={fSatuan} onChange={e => setFSatuan(e.target.value)}>
                {SAPROTAN_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <input className={inputCls} placeholder="Lokasi Penyimpanan" value={fLokasi} onChange={e => setFLokasi(e.target.value)} />
            <input className={inputCls} type="number" placeholder="Stok minimum" value={fMinStok} onChange={e => setFMinStok(e.target.value)} />
          </div>
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={handleSave} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Menyimpan..." : "Simpan"}</button>
            <button type="button" onClick={reset} className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-[#8B8AA0]">Batal</button>
          </div>
        </div>
      )}

      <div className={`${cardCls} overflow-hidden`}>
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#8B8AA0]">{compact ? "Belum ada data. Buka tab Catat untuk tambah." : "Belum ada saprotan. Tambah benih, pupuk, atau pestisida."}</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filtered.map(p => {
              const m = getMeta(p.id);
              const low = p.stock <= p.min_stock;
              return (
                <div key={p.id} className="flex items-center gap-3 p-4 hover:bg-white/[0.02]">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.name} {m?.merek ? `· ${m.merek}` : ""}</p>
                    <p className="text-[11px] text-[#8B8AA0]">{p.category} · {p.stock} {m?.satuan || "kg"} · {m?.supplier || "—"}</p>
                  </div>
                  {low && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">Menipis</span>}
                  <p className="text-sm font-mono text-emerald-400">{fmtRp((p.cost || 0) * p.stock)}</p>
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
