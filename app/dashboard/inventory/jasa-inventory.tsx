"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Briefcase, Plus, Search, ArrowDownToLine, ArrowUpFromLine, ShoppingCart, X } from "lucide-react";
import { getConfig } from "./business-config";
import DeleteTransactionButton from "../delete-transaction-button";
import EditProductModal from "./edit-product-modal";
import FnbEmptyState from "../fnb/components/fnb-empty-state";
import { addProduct, fmtRp, type ProductRow, type StockMovementRow } from "./lib/typed-stock-actions";
import { RecentMovementsStrip, StockActionSheet, inputCls } from "./lib/inventory-ui-shared";

const ACCENT = "#EC4899";
const BTN = { background: "linear-gradient(135deg, #EC4899, #8B5CF6)", color: "#070711" } as const;

export default function JasaInventory({
  products, userId, businessId, movements = [],
}: {
  products: ProductRow[];
  userId: string;
  businessId?: string;
  movements?: StockMovementRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const config = getConfig("jasa");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [sheet, setSheet] = useState<"masuk" | "keluar" | "jual" | null>(null);
  const [active, setActive] = useState<ProductRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [fName, setFName] = useState("");
  const [fCat, setFCat] = useState("Peralatan Kerja");
  const [fStock, setFStock] = useState("1");
  const [fCost, setFCost] = useState("");
  const [fPrice, setFPrice] = useState("");

  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search],
  );
  const nilaiAset = products.reduce((s, p) => s + Number(p.stock) * Number(p.cost || p.price || 0), 0);

  const handleAdd = async () => {
    if (!fName.trim()) return;
    setLoading(true);
    const { error } = await addProduct(supabase, {
      userId, businessId, name: fName, category: fCat,
      stock: Number(fStock) || 1, minStock: 0,
      price: fPrice ? Number(fPrice) : null, cost: fCost ? Number(fCost) : null,
      unit: "unit", buyCategory: "Pembelian Aset",
    });
    setLoading(false);
    if (error) { alert(error.message); return; }
    setFName(""); setFStock("1"); setFCost(""); setFPrice(""); setShowAdd(false);
    router.refresh();
  };

  return (
    <div className="pb-24">
      <div className="mb-4 overflow-hidden rounded-2xl border border-[#EC4899]/25 bg-gradient-to-br from-[#1A0F18] to-[#0D0D1A]">
        <div className="h-1 bg-gradient-to-r from-[#EC4899] to-[#8B5CF6]" />
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EC4899]/15">
              <Briefcase size={18} className="text-[#EC4899]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#F0EFF8]">Register Aset Jasa</p>
              <p className="text-[11px] text-[#8B8AA0]">Peralatan · pinjam · rusak · jual opsional</p>
            </div>
          </div>
          <Link href="/dashboard/jasa" className="rounded-full border border-[#EC4899]/30 px-3 py-1.5 text-xs text-[#EC4899]">Order Jasa →</Link>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-white/[0.06] bg-white/[0.03]">
          <div className="bg-[#0D0D1A] p-3"><p className="text-[10px] text-[#8B8AA0]">Total aset</p><p className="font-mono text-lg font-semibold text-[#EC4899]">{products.length}</p></div>
          <div className="bg-[#0D0D1A] p-3"><p className="text-[10px] text-[#8B8AA0]">Nilai aset</p><p className="font-mono text-lg font-semibold text-[#8B5CF6]">{fmtRp(nilaiAset)}</p></div>
        </div>
      </div>

      <RecentMovementsStrip movements={movements} accent={ACCENT} />

      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5B7A]" />
          <input className={`${inputCls} pl-9`} placeholder="Cari aset..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 rounded-xl px-3 text-sm font-semibold" style={BTN}>
          <Plus size={14} /> Aset
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 space-y-2 rounded-2xl border border-[#EC4899]/25 bg-[#140E14] p-4">
          <input className={inputCls} placeholder="Nama aset *" value={fName} onChange={(e) => setFName(e.target.value)} />
          <select className={inputCls} value={fCat} onChange={(e) => setFCat(e.target.value)}>
            {config.kategoriDefault.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input className={inputCls} type="number" placeholder="Qty" value={fStock} onChange={(e) => setFStock(e.target.value)} />
            <input className={inputCls} type="number" placeholder="Nilai modal" value={fCost} onChange={(e) => setFCost(e.target.value)} />
            <input className={inputCls} type="number" placeholder="Harga jual" value={fPrice} onChange={(e) => setFPrice(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={loading} onClick={handleAdd} className="flex-1 rounded-xl py-2.5 text-sm font-semibold" style={BTN}>{loading ? "..." : "Simpan aset"}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-xl border border-white/10 px-3 text-[#8B8AA0]"><X size={16} /></button>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <FnbEmptyState icon={Briefcase} title="Belum ada aset" subtitle="Catat kamera, laptop, kendaraan, dll. untuk pekerjaan jasa." actionLabel="Tambah aset" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
          <div className="hidden grid-cols-[1.4fr_0.8fr_0.6fr_1.2fr] gap-2 border-b border-white/[0.06] bg-[#1A0F18] px-4 py-2 text-[10px] uppercase tracking-wide text-[#5A5B7A] sm:grid">
            <span>Aset</span><span>Kategori</span><span>Qty</span><span>Aksi</span>
          </div>
          {filtered.map((p, i) => (
            <div key={p.id} className={`grid grid-cols-1 gap-2 border-b border-white/[0.04] px-4 py-3 sm:grid-cols-[1.4fr_0.8fr_0.6fr_1.2fr] sm:items-center ${i % 2 ? "bg-[#0F0A10]" : "bg-[#0D0D1A]"}`}>
              <div>
                <p className="text-sm font-medium text-[#F0EFF8]">{p.name}</p>
                <p className="text-[11px] text-[#8B8AA0] sm:hidden">{p.category} · qty {p.stock}</p>
                {p.cost != null && <p className="text-[10px] text-[#5A5B7A]">Modal {fmtRp(Number(p.cost))}</p>}
              </div>
              <p className="hidden text-xs text-[#8B8AA0] sm:block">{p.category || "—"}</p>
              <p className="hidden font-mono text-sm text-[#EC4899] sm:block">{p.stock}</p>
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => { setActive(p); setSheet("masuk"); }} className="rounded-md bg-[#EC4899]/10 px-2 py-1 text-[10px] text-[#EC4899]"><ArrowDownToLine size={10} className="inline" /> Masuk</button>
                <button type="button" onClick={() => { setActive(p); setSheet("keluar"); }} className="rounded-md bg-[#F59E0B]/10 px-2 py-1 text-[10px] text-[#F59E0B]"><ArrowUpFromLine size={10} className="inline" /> Pinjam/Rusak</button>
                <button type="button" onClick={() => { setActive(p); setSheet("jual"); }} className="rounded-md bg-[#8B5CF6]/10 px-2 py-1 text-[10px] text-[#8B5CF6]"><ShoppingCart size={10} className="inline" /> Jual</button>
                <EditProductModal product={p as never} />
                <DeleteTransactionButton id={p.id} table="products" />
              </div>
            </div>
          ))}
        </div>
      )}

      {sheet && active && (
        <StockActionSheet
          mode={sheet} product={active} onClose={() => { setSheet(null); setActive(null); }}
          userId={userId} businessId={businessId}
          buyCategory="Pembelian Aset" sellCategory="Penjualan Aset"
          reasons={config.alasanKeluar} accent={ACCENT}
          defaultReason={sheet === "keluar" ? "dipinjam" : undefined}
        />
      )}
    </div>
  );
}
