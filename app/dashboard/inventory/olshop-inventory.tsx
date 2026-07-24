"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ShoppingBag, Plus, Search, ArrowDownToLine, ArrowUpFromLine, ShoppingCart, X, Package } from "lucide-react";
import { getConfig } from "./business-config";
import DeleteTransactionButton from "../delete-transaction-button";
import EditProductModal from "./edit-product-modal";
import FnbEmptyState from "../fnb/components/fnb-empty-state";
import { addProduct, fmtRp, type ProductRow, type StockMovementRow } from "./lib/typed-stock-actions";
import { RecentMovementsStrip, StockActionSheet, inputCls } from "./lib/inventory-ui-shared";

const ACCENT = "#F43F5E";
const BTN = { background: "linear-gradient(135deg, #F43F5E, #EC4899)", color: "#070711" } as const;

export default function OlshopInventory({
  products, userId, businessId, movements = [],
}: {
  products: ProductRow[];
  userId: string;
  businessId?: string;
  movements?: StockMovementRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const config = getConfig("olshop");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "ready" | "kritis">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [sheet, setSheet] = useState<"masuk" | "keluar" | "jual" | null>(null);
  const [active, setActive] = useState<ProductRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [fName, setFName] = useState("");
  const [fSku, setFSku] = useState("");
  const [fCat, setFCat] = useState("Fashion");
  const [fStock, setFStock] = useState("");
  const [fMin, setFMin] = useState("3");
  const [fCost, setFCost] = useState("");
  const [fPrice, setFPrice] = useState("");

  const ready = products.filter((p) => Number(p.stock) > Number(p.min_stock) && Number(p.price || 0) > 0);
  const kritis = products.filter((p) => Number(p.stock) <= Number(p.min_stock));

  const filtered = useMemo(() => {
    let list = products.filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku || "").toLowerCase().includes(search.toLowerCase()),
    );
    if (filter === "ready") list = list.filter((p) => Number(p.stock) > Number(p.min_stock) && Number(p.price || 0) > 0);
    if (filter === "kritis") list = list.filter((p) => Number(p.stock) <= Number(p.min_stock));
    return list;
  }, [products, search, filter]);

  const handleAdd = async () => {
    if (!fName.trim() || !fStock) return;
    setLoading(true);
    const { error } = await addProduct(supabase, {
      userId, businessId, name: fName, sku: fSku || null, category: fCat,
      stock: Number(fStock), minStock: Number(fMin) || 0,
      price: fPrice ? Number(fPrice) : null, cost: fCost ? Number(fCost) : null,
      unit: "pcs", buyCategory: "Pembelian Barang",
    });
    setLoading(false);
    if (error) { alert(error.message); return; }
    setFName(""); setFSku(""); setFStock(""); setFMin("3"); setFCost(""); setFPrice("");
    setShowAdd(false);
    router.refresh();
  };

  return (
    <div className="pb-24">
      <div className="mb-4 overflow-hidden rounded-[1.5rem] border border-[#F43F5E]/25 bg-[#140A10]">
        <div className="bg-gradient-to-r from-[#F43F5E]/20 via-[#EC4899]/10 to-transparent px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-[#F43F5E]" />
              <div>
                <p className="text-sm font-semibold text-[#F0EFF8]">Katalog Online Shop</p>
                <p className="text-[11px] text-[#8B8AA0]">Siap jual · sync stok marketplace</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard/olshop" className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#8B8AA0]">Pusat Olshop →</Link>
              <Link href="/dashboard/marketplace" className="rounded-full border border-[#F43F5E]/30 bg-[#F43F5E]/10 px-3 py-1.5 text-xs text-[#F43F5E]">Marketplace →</Link>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px border-t border-white/[0.06] bg-white/[0.03]">
          <div className="bg-[#140A10] p-3 text-center"><p className="text-[10px] text-[#8B8AA0]">Produk</p><p className="font-mono text-lg font-semibold text-[#F43F5E]">{products.length}</p></div>
          <div className="bg-[#140A10] p-3 text-center"><p className="text-[10px] text-[#8B8AA0]">Siap jual</p><p className="font-mono text-lg font-semibold text-[#2DD4BF]">{ready.length}</p></div>
          <div className="bg-[#140A10] p-3 text-center"><p className="text-[10px] text-[#8B8AA0]">Kritis</p><p className="font-mono text-lg font-semibold text-[#F59E0B]">{kritis.length}</p></div>
        </div>
      </div>

      <RecentMovementsStrip movements={movements} accent={ACCENT} />

      <div className="mb-3 flex flex-wrap gap-2">
        {([
          { key: "all" as const, label: "Semua" },
          { key: "ready" as const, label: `Siap jual (${ready.length})` },
          { key: "kritis" as const, label: `Kritis (${kritis.length})` },
        ]).map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
            className="rounded-full px-3 py-1.5 text-[11px] font-medium"
            style={filter === f.key ? { background: `${ACCENT}33`, color: ACCENT } : { background: "rgba(255,255,255,0.05)", color: "#8B8AA0" }}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5B7A]" />
          <input className={`${inputCls} pl-9`} placeholder="Cari produk katalog..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 rounded-xl px-3 text-sm font-semibold" style={BTN}>
          <Plus size={14} /> Produk
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 space-y-2 rounded-2xl border border-[#F43F5E]/25 bg-[#1A0C12] p-4">
          <input className={inputCls} placeholder="Nama produk *" value={fName} onChange={(e) => setFName(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="SKU" value={fSku} onChange={(e) => setFSku(e.target.value)} />
            <select className={inputCls} value={fCat} onChange={(e) => setFCat(e.target.value)}>
              {config.kategoriDefault.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input className={inputCls} type="number" placeholder="Stok *" value={fStock} onChange={(e) => setFStock(e.target.value)} />
            <input className={inputCls} type="number" placeholder="Min" value={fMin} onChange={(e) => setFMin(e.target.value)} />
            <input className={inputCls} type="number" placeholder="Modal" value={fCost} onChange={(e) => setFCost(e.target.value)} />
            <input className={inputCls} type="number" placeholder="Harga jual" value={fPrice} onChange={(e) => setFPrice(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={loading} onClick={handleAdd} className="flex-1 rounded-xl py-2.5 text-sm font-semibold" style={BTN}>{loading ? "..." : "Publish ke katalog"}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-xl border border-white/10 px-3 text-[#8B8AA0]"><X size={16} /></button>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <FnbEmptyState icon={ShoppingBag} title="Katalog masih kosong" subtitle="Tambah produk online — pastikan stok & harga biar siap jual." actionLabel="Tambah produk" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const low = Number(p.stock) <= Number(p.min_stock);
            const isReady = !low && Number(p.price || 0) > 0;
            return (
              <div key={p.id} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12080C]">
                <div className="relative flex h-28 items-center justify-center bg-gradient-to-br from-[#F43F5E]/15 to-transparent">
                  {p.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package size={28} className="text-[#F43F5E]/50" />
                  )}
                  <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isReady ? "bg-[#2DD4BF]/20 text-[#2DD4BF]" : low ? "bg-[#F59E0B]/20 text-[#F59E0B]" : "bg-white/10 text-[#8B8AA0]"}`}>
                    {isReady ? "Siap jual" : low ? "Stok kritis" : "Draft harga"}
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate font-semibold text-[#F0EFF8]">{p.name}</p>
                  <p className="text-[11px] text-[#8B8AA0]">{p.category}{p.sku ? ` · ${p.sku}` : ""}</p>
                  <div className="mt-2 flex items-end justify-between">
                    <div>
                      <p className="font-mono text-sm font-semibold text-[#F43F5E]">{p.price != null ? fmtRp(Number(p.price)) : "—"}</p>
                      <p className="text-[10px] text-[#5A5B7A]">Stok {p.stock}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1">
                    <button type="button" onClick={() => { setActive(p); setSheet("masuk"); }} className="rounded-lg bg-[#2DD4BF]/10 py-1.5 text-[10px] text-[#2DD4BF]"><ArrowDownToLine size={12} className="mx-auto" /></button>
                    <button type="button" onClick={() => { setActive(p); setSheet("keluar"); }} className="rounded-lg bg-[#F59E0B]/10 py-1.5 text-[10px] text-[#F59E0B]"><ArrowUpFromLine size={12} className="mx-auto" /></button>
                    <button type="button" onClick={() => { setActive(p); setSheet("jual"); }} className="rounded-lg bg-[#F43F5E]/15 py-1.5 text-[10px] text-[#F43F5E]"><ShoppingCart size={12} className="mx-auto" /></button>
                    <div className="flex items-center justify-center gap-0.5">
                      <EditProductModal product={p as never} />
                      <DeleteTransactionButton id={p.id} table="products" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sheet && active && (
        <StockActionSheet
          mode={sheet} product={active} onClose={() => { setSheet(null); setActive(null); }}
          userId={userId} businessId={businessId}
          buyCategory="Pembelian Barang" sellCategory="Penjualan"
          reasons={config.alasanKeluar} accent={ACCENT}
        />
      )}
    </div>
  );
}
