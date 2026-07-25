"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Package, Plus, Pencil, X, Check, Search } from "lucide-react";
import type { Product } from "../page";
import { isRetailSellable } from "@/lib/pos/retail-sellable";

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }

const KATEGORI_RETAIL = ["Penjualan", "Sembako", "Minuman", "Makanan", "Rokok", "Kebutuhan Rumah", "Lainnya"];

type Draft = {
  name: string; category: string; price: string; cost: string;
  stock: string; sku: string;
};

const emptyDraft: Draft = { name: "", category: "Penjualan", price: "", cost: "", stock: "", sku: "" };

export default function KasirProduk({
  userId, businessId, products,
}: {
  userId: string; businessId: string; products: Product[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(false);

  const inputCls =
    "w-full rounded-xl border border-[#C5D4CB] bg-white px-3 py-2.5 text-sm text-[#0F1F17] outline-none focus:ring-2 focus:ring-[#007A4D]/25";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category || "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const sellableCount = products.filter(isRetailSellable).length;

  const saveNew = async () => {
    if (!draft.name.trim()) { alert("Nama produk wajib."); return; }
    const price = Number(draft.price) || 0;
    if (price <= 0) { alert("Harga jual wajib > 0 supaya bisa dijual di kasir."); return; }
    setLoading(true);
    const { error } = await supabase.from("products").insert({
      user_id: userId,
      business_id: businessId,
      name: draft.name.trim(),
      sku: draft.sku.trim() || null,
      category: draft.category || "Penjualan",
      stock: Number(draft.stock) || 0,
      min_stock: 5,
      price,
      cost: draft.cost ? Number(draft.cost) : null,
    });
    setLoading(false);
    if (error) { alert("Gagal simpan: " + error.message); return; }
    setDraft(emptyDraft);
    setShowForm(false);
    router.refresh();
  };

  const startEdit = (p: Product) => {
    setEditId(p.id);
    setEditDraft({
      name: p.name,
      category: p.category || "Penjualan",
      price: String(p.price ?? ""),
      cost: String(p.cost ?? ""),
      stock: String(p.stock ?? 0),
      sku: p.sku || "",
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    setLoading(true);
    const { error } = await supabase.from("products").update({
      name: editDraft.name.trim(),
      category: editDraft.category || null,
      price: Number(editDraft.price) || 0,
      cost: editDraft.cost ? Number(editDraft.cost) : null,
      stock: Number(editDraft.stock) || 0,
      sku: editDraft.sku.trim() || null,
    }).eq("id", editId);
    setLoading(false);
    if (error) { alert("Gagal update: " + error.message); return; }
    setEditId(null);
    router.refresh();
  };

  const draftForm = (d: Draft, set: (d: Draft) => void) => (
    <div className="grid gap-2">
      <input className={inputCls} placeholder="Nama produk (contoh: Indomie Goreng)"
        value={d.name} onChange={(e) => set({ ...d, name: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <select className={inputCls} value={d.category} onChange={(e) => set({ ...d, category: e.target.value })}>
          {KATEGORI_RETAIL.map((k) => <option key={k} value={k}>{k}</option>)}
          {!KATEGORI_RETAIL.includes(d.category) && d.category && <option value={d.category}>{d.category}</option>}
        </select>
        <input className={inputCls + " font-mono"} placeholder="SKU / barcode (opsional)"
          value={d.sku} onChange={(e) => set({ ...d, sku: e.target.value })} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input className={inputCls + " font-mono"} type="number" placeholder="Harga jual *"
          value={d.price} onChange={(e) => set({ ...d, price: e.target.value })} />
        <input className={inputCls + " font-mono"} type="number" placeholder="Modal (HPP)"
          value={d.cost} onChange={(e) => set({ ...d, cost: e.target.value })} />
        <input className={inputCls + " font-mono"} type="number" placeholder="Stok"
          value={d.stock} onChange={(e) => set({ ...d, stock: e.target.value })} />
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0F1F17]">Produk toko</p>
          <p className="text-[11px] text-[#5C6B63]">
            {sellableCount} siap jual dari {products.length} total. Harga jual wajib &gt; 0 supaya muncul di kasir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#007A4D] px-4 py-2.5 text-xs font-semibold text-white"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Tutup" : "Tambah produk"}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-2xl border border-[#007A4D]/30 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#007A4D]">Produk baru</p>
          {draftForm(draft, setDraft)}
          <button
            type="button"
            disabled={loading}
            onClick={saveNew}
            className="mt-3 w-full rounded-xl bg-[#007A4D] py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {loading ? "Menyimpan…" : "Simpan produk"}
          </button>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#C5D4CB] bg-white px-3 py-2.5">
        <Search size={14} className="text-[#007A4D]" />
        <input
          className="flex-1 bg-transparent text-sm text-[#0F1F17] outline-none placeholder:text-[#8A9A90]"
          placeholder="Cari produk / SKU / kategori…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#007A4D]/30 bg-white/70 p-8 text-center">
          <Package size={28} className="mx-auto mb-2 text-[#8A9A90]" />
          <p className="text-sm text-[#5C6B63]">
            {products.length === 0 ? "Belum ada produk. Klik “Tambah produk” di atas." : "Tidak ditemukan."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const sellable = isRetailSellable(p);
            if (editId === p.id) {
              return (
                <div key={p.id} className="rounded-2xl border border-[#007A4D]/40 bg-white p-4 shadow-sm">
                  {draftForm(editDraft, setEditDraft)}
                  <div className="mt-3 flex gap-2">
                    <button type="button" disabled={loading} onClick={saveEdit}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#007A4D] py-2.5 text-xs font-semibold text-white disabled:opacity-40">
                      <Check size={13} /> Simpan
                    </button>
                    <button type="button" onClick={() => setEditId(null)}
                      className="rounded-xl border border-[#C5D4CB] bg-white px-4 text-xs font-medium text-[#5C6B63]">
                      Batal
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-[#C5D4CB] bg-white px-4 py-3 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: sellable ? "rgba(0,122,77,.1)" : "rgba(0,0,0,.05)" }}>
                  <Package size={16} style={{ color: sellable ? "#007A4D" : "#8A9A90" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#0F1F17]">{p.name}</p>
                  <p className="text-[10px] text-[#5C6B63]">
                    {p.category || "Tanpa kategori"}{p.sku ? ` · ${p.sku}` : ""} · stok {p.stock}
                    {!sellable && <span className="ml-1 font-semibold text-[#B45309]">— belum siap jual</span>}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold" style={{ color: sellable ? "#007A4D" : "#8A9A90" }}>
                  {fmtRp(p.price || 0)}
                </p>
                <button type="button" onClick={() => startEdit(p)}
                  className="rounded-lg border border-[#C5D4CB] bg-white p-2 text-[#5C6B63] hover:text-[#007A4D]">
                  <Pencil size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
