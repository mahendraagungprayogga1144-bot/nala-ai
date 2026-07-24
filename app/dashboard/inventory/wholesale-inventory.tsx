"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Boxes, Plus, Search, ArrowDownToLine, ArrowUpFromLine, ShoppingCart, X } from "lucide-react";
import { getConfig } from "./business-config";
import DeleteTransactionButton from "../delete-transaction-button";
import EditProductModal from "./edit-product-modal";
import FnbEmptyState from "../fnb/components/fnb-empty-state";
import {
  addProduct, fmtRp, type ProductAttr, type ProductRow, type StockMovementRow,
} from "./lib/typed-stock-actions";
import { RecentMovementsStrip, StockActionSheet, inputCls } from "./lib/inventory-ui-shared";

const ACCENT = "#6366F1";
const BTN = { background: "linear-gradient(135deg, #6366F1, #2DD4BF)", color: "#070711" } as const;

export default function WholesaleInventory({
  products, userId, businessId, attrs = [], movements = [],
}: {
  products: ProductRow[];
  userId: string;
  businessId?: string;
  attrs?: ProductAttr[];
  movements?: StockMovementRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const config = getConfig("wholesale");
  const attrMap = useMemo(() => Object.fromEntries(attrs.map((a) => [String(a.product_id), a])), [attrs]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [sheet, setSheet] = useState<"masuk" | "keluar" | "jual" | null>(null);
  const [active, setActive] = useState<ProductRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [fName, setFName] = useState("");
  const [fSku, setFSku] = useState("");
  const [fCat, setFCat] = useState("Sembako");
  const [fStock, setFStock] = useState("");
  const [fCost, setFCost] = useState("");
  const [fPrice, setFPrice] = useState("");
  const [fMoq, setFMoq] = useState("10");
  const [fWprice, setFWprice] = useState("");

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.sku || "").toLowerCase().includes(search.toLowerCase()),
      ),
    [products, search],
  );

  const handleAdd = async () => {
    if (!fName.trim() || !fStock) return;
    setLoading(true);
    const { error } = await addProduct(supabase, {
      userId, businessId, name: fName, sku: fSku || null, category: fCat,
      stock: Number(fStock), minStock: Number(fMoq) || 5,
      price: fPrice ? Number(fPrice) : null, cost: fCost ? Number(fCost) : null,
      unit: "karton", buyCategory: "Pembelian Grosir", attrsMode: "wholesale",
      moq: fMoq ? Number(fMoq) : null, wholesalePrice: fWprice ? Number(fWprice) : null,
    });
    setLoading(false);
    if (error) { alert(error.message); return; }
    setFName(""); setFSku(""); setFStock(""); setFCost(""); setFPrice(""); setFMoq("10"); setFWprice("");
    setShowAdd(false);
    router.refresh();
  };

  return (
    <div className="pb-24">
      <div className="mb-4 rounded-2xl border border-[#6366F1]/30 bg-[#0E0E1C] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Boxes size={18} className="text-[#6366F1]" />
            <div>
              <p className="text-sm font-semibold text-[#F0EFF8]">Gudang Partai / Grosir</p>
              <p className="text-[11px] text-[#8B8AA0]">Tabel SKU · MOQ · harga grosir · qty besar</p>
            </div>
          </div>
          <Link href="/dashboard/wholesale" className="rounded-full border border-[#6366F1]/30 px-3 py-1.5 text-xs text-[#6366F1]">Pusat Grosir →</Link>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-[#6366F1]/10 p-2"><p className="text-[10px] text-[#8B8AA0]">SKU</p><p className="font-mono font-semibold text-[#6366F1]">{products.length}</p></div>
          <div className="rounded-xl bg-[#2DD4BF]/10 p-2"><p className="text-[10px] text-[#8B8AA0]">Punya MOQ</p><p className="font-mono font-semibold text-[#2DD4BF]">{attrs.filter((a) => a.min_order_qty).length}</p></div>
          <div className="rounded-xl bg-white/5 p-2"><p className="text-[10px] text-[#8B8AA0]">Nilai</p><p className="truncate font-mono text-xs font-semibold text-[#F0EFF8]">{fmtRp(products.reduce((s, p) => s + Number(p.stock) * Number(attrMap[p.id]?.wholesale_price || p.price || 0), 0))}</p></div>
        </div>
      </div>

      <RecentMovementsStrip movements={movements} accent={ACCENT} />

      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5B7A]" />
          <input className={`${inputCls} pl-9`} placeholder="Cari SKU / nama..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 rounded-xl px-3 text-sm font-semibold" style={BTN}>
          <Plus size={14} /> SKU
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 space-y-2 rounded-2xl border border-[#6366F1]/25 bg-[#12122A] p-4">
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="Nama *" value={fName} onChange={(e) => setFName(e.target.value)} />
            <input className={inputCls} placeholder="SKU" value={fSku} onChange={(e) => setFSku(e.target.value)} />
          </div>
          <select className={inputCls} value={fCat} onChange={(e) => setFCat(e.target.value)}>
            {config.kategoriDefault.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input className={inputCls} type="number" placeholder="Stok *" value={fStock} onChange={(e) => setFStock(e.target.value)} />
            <input className={inputCls} type="number" placeholder="MOQ" value={fMoq} onChange={(e) => setFMoq(e.target.value)} />
            <input className={inputCls} type="number" placeholder="Modal" value={fCost} onChange={(e) => setFCost(e.target.value)} />
            <input className={inputCls} type="number" placeholder="Harga ecer" value={fPrice} onChange={(e) => setFPrice(e.target.value)} />
          </div>
          <input className={inputCls} type="number" placeholder="Harga grosir" value={fWprice} onChange={(e) => setFWprice(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" disabled={loading} onClick={handleAdd} className="flex-1 rounded-xl py-2.5 text-sm font-semibold" style={BTN}>{loading ? "..." : "Simpan partai"}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-xl border border-white/10 px-3 text-[#8B8AA0]"><X size={16} /></button>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <FnbEmptyState icon={Boxes} title="Gudang kosong" subtitle="Tambah SKU dengan MOQ & harga grosir untuk jual partai." actionLabel="Tambah SKU" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-[#16162E] text-[10px] uppercase tracking-wide text-[#5A5B7A]">
              <tr>
                <th className="px-3 py-2.5">SKU / Nama</th>
                <th className="px-3 py-2.5">Stok</th>
                <th className="px-3 py-2.5">MOQ</th>
                <th className="px-3 py-2.5">Grosir</th>
                <th className="px-3 py-2.5">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const a = attrMap[p.id];
                const low = Number(p.stock) <= Number(p.min_stock);
                const underMoq = a?.min_order_qty != null && Number(p.stock) < Number(a.min_order_qty);
                return (
                  <tr key={p.id} className="border-t border-white/[0.04] hover:bg-[#6366F1]/5">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-[#F0EFF8]">{p.name}</p>
                      <p className="text-[10px] text-[#5A5B7A]">{p.sku || p.category || "—"}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-mono ${low || underMoq ? "text-[#F59E0B]" : "text-[#2DD4BF]"}`}>{p.stock}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[#8B8AA0]">{a?.min_order_qty ?? "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-[#6366F1]">
                      {a?.wholesale_price != null ? fmtRp(Number(a.wholesale_price)) : p.price != null ? fmtRp(Number(p.price)) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" onClick={() => { setActive(p); setSheet("masuk"); }} className="rounded bg-[#2DD4BF]/10 px-1.5 py-1 text-[#2DD4BF]"><ArrowDownToLine size={12} /></button>
                        <button type="button" onClick={() => { setActive(p); setSheet("keluar"); }} className="rounded bg-[#F59E0B]/10 px-1.5 py-1 text-[#F59E0B]"><ArrowUpFromLine size={12} /></button>
                        <button type="button" onClick={() => { setActive(p); setSheet("jual"); }} className="inline-flex items-center gap-0.5 rounded bg-[#6366F1]/15 px-2 py-1 text-[10px] font-semibold text-[#6366F1]"><ShoppingCart size={11} /> Jual</button>
                        <EditProductModal product={p as never} userId={userId} businessId={businessId} attrsMode="wholesale" attr={a} />
                        <DeleteTransactionButton id={p.id} table="products" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sheet && active && (
        <StockActionSheet
          mode={sheet} product={active} onClose={() => { setSheet(null); setActive(null); }}
          userId={userId} businessId={businessId}
          buyCategory="Pembelian Grosir" sellCategory="Penjualan Grosir"
          reasons={config.alasanKeluar} accent={ACCENT} attrsMode="wholesale"
          moq={attrMap[active.id]?.min_order_qty} wholesalePrice={attrMap[active.id]?.wholesale_price}
        />
      )}
    </div>
  );
}
