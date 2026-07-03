"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Package } from "lucide-react";
import type { MpStore, MpProduct } from "../page";
import { platformColor, fmtRp } from "../mp-constants";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../../components/module-form-styles";

function stokBadge(stok: number) {
  if (stok <= 0) return { label: "Habis", bg: "rgba(244,63,94,.12)", text: "#F43F5E", border: "rgba(244,63,94,.3)" };
  if (stok <= 5) return { label: "Rendah", bg: "rgba(251,191,36,.12)", text: "#FBBF24", border: "rgba(251,191,36,.3)" };
  return { label: "Aman", bg: "rgba(74,222,128,.12)", text: "#4ADE80", border: "rgba(74,222,128,.3)" };
}

export default function MpProductsTab({
  stores, products, businessId, userId,
}: { stores: MpStore[]; products: MpProduct[]; businessId: string; userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ store_id: stores[0]?.id || "", nama: "", sku: "", harga: "", stok: "", kategori: "", catatan: "" });

  const grouped = useMemo(() => {
    const map = new Map<string, { store: MpStore; items: MpProduct[] }>();
    stores.forEach(s => map.set(s.id, { store: s, items: [] }));
    products.forEach(p => {
      const g = map.get(p.store_id);
      if (g) g.items.push(p);
    });
    return [...map.values()].filter(g => g.items.length > 0);
  }, [stores, products]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim() || !form.store_id) return;
    setLoading(true);
    const store = stores.find(s => s.id === form.store_id);
    const { error } = await supabase.from("module_mp_products").insert({
      user_id: userId, business_id: businessId,
      store_id: form.store_id, platform: store?.platform || null,
      nama: form.nama.trim(), sku: form.sku || null,
      harga: Number(form.harga) || 0, stok: Number(form.stok) || 0,
      kategori: form.kategori || null, catatan: form.catatan || null,
    });
    setLoading(false);
    if (error) return alert(error.message);
    setForm({ store_id: stores[0]?.id || "", nama: "", sku: "", harga: "", stok: "", kategori: "", catatan: "" });
    setOpen(false);
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus produk ini?")) return;
    await supabase.from("module_mp_products").delete().eq("id", id);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[#8B8AA0]">{products.length} produk</p>
        <button type="button" onClick={() => setOpen(!open)} disabled={stores.length === 0} className={"flex items-center gap-1.5 " + MODULE_BTN}>
          <Plus size={14} /> Tambah produk
        </button>
      </div>

      {stores.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
          <p className="text-sm text-[#5A5B7A]">Tambahkan toko terlebih dahulu di tab Toko.</p>
        </div>
      )}

      {open && (
        <form onSubmit={save} className={MODULE_CARD + " mb-6 grid gap-3 sm:grid-cols-2"}>
          <select required className={MODULE_INPUT} value={form.store_id} onChange={e => setForm({ ...form, store_id: e.target.value })}>
            <option value="">Pilih toko *</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.nama_toko} ({s.platform})</option>)}
          </select>
          <input required className={MODULE_INPUT} placeholder="Nama produk *" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="SKU" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
          <input className={MODULE_INPUT} type="number" placeholder="Harga (Rp)" value={form.harga} onChange={e => setForm({ ...form, harga: e.target.value })} />
          <input className={MODULE_INPUT} type="number" placeholder="Stok" value={form.stok} onChange={e => setForm({ ...form, stok: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Kategori" value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })} />
          <input className={MODULE_INPUT + " sm:col-span-2"} placeholder="Catatan" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={loading} className={MODULE_BTN + " flex-1"}>{loading ? "Menyimpan..." : "Simpan produk"}</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-[#8B8AA0]">Batal</button>
          </div>
        </form>
      )}

      {grouped.length > 0 && grouped.map(g => (
        <div key={g.store.id} className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: platformColor(g.store.platform) }} />
            <p className="text-sm font-semibold">{g.store.nama_toko}</p>
            <span className="text-[10px] uppercase font-semibold" style={{ color: platformColor(g.store.platform) }}>{g.store.platform}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map(p => {
              const sb = stokBadge(p.stok);
              return (
                <div key={p.id} className="group relative rounded-xl border border-white/[0.08] bg-[#0D0D1A] p-3 transition-colors hover:border-white/[0.15]">
                  <div className="flex items-start gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2DD4BF]/10 text-[#2DD4BF]">
                      <Package size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{p.nama}</p>
                      {p.sku && <p className="text-[10px] text-[#5A5B7A]">SKU: {p.sku}</p>}
                    </div>
                    <button type="button" onClick={() => remove(p.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#5A5B7A] hover:text-[#F43F5E]">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="font-mono text-xs font-semibold text-[#2DD4BF]">{fmtRp(Number(p.harga))}</p>
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ background: sb.bg, color: sb.text, border: `1px solid ${sb.border}` }}>
                      Stok {p.stok} · {sb.label}
                    </span>
                  </div>
                  {p.kategori && <p className="mt-1 text-[10px] text-[#5A5B7A]">{p.kategori}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
