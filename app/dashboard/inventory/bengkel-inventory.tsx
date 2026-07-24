"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Wrench, Plus, Search, ArrowDownToLine, ArrowUpFromLine, ShoppingCart, X } from "lucide-react";
import { getConfig } from "./business-config";
import DeleteTransactionButton from "../delete-transaction-button";
import EditProductModal from "./edit-product-modal";
import FnbEmptyState from "../fnb/components/fnb-empty-state";
import { addProduct, fmtRp, type ProductRow, type StockMovementRow } from "./lib/typed-stock-actions";
import { RecentMovementsStrip, StockActionSheet, inputCls } from "./lib/inventory-ui-shared";

const ACCENT = "#EF4444";
const BTN = { background: "linear-gradient(135deg, #EF4444, #F59E0B)", color: "#070711" } as const;

const RACKS = [
  { key: "oli", label: "Oli & Filter", cats: ["Oli", "Filter"], color: "#EF4444" },
  { key: "part", label: "Ban · Aki · Rem · Busi", cats: ["Ban", "Aki", "Rem", "Busi"], color: "#F59E0B" },
  { key: "body", label: "Body & Aksesoris", cats: ["Lampu", "Body", "Aksesoris", "Lainnya"], color: "#8B5CF6" },
];

export default function BengkelInventory({
  products, userId, businessId, movements = [],
}: {
  products: ProductRow[];
  userId: string;
  businessId?: string;
  movements?: StockMovementRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const config = getConfig("bengkel");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"masuk" | "keluar" | "jual" | null>(null);
  const [active, setActive] = useState<ProductRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [fName, setFName] = useState("");
  const [fCat, setFCat] = useState("Oli");
  const [fStock, setFStock] = useState("");
  const [fMin, setFMin] = useState("3");
  const [fCost, setFCost] = useState("");
  const [fPrice, setFPrice] = useState("");

  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search],
  );
  const kritis = products.filter((p) => Number(p.stock) <= Number(p.min_stock));

  const handleAdd = async (defaultCat: string) => {
    if (!fName.trim() || !fStock) return;
    setLoading(true);
    const { error } = await addProduct(supabase, {
      userId, businessId, name: fName, category: fCat || defaultCat,
      stock: Number(fStock), minStock: Number(fMin) || 0,
      price: fPrice ? Number(fPrice) : null, cost: fCost ? Number(fCost) : null,
      unit: "pcs", buyCategory: "Pembelian Spare Part",
    });
    setLoading(false);
    if (error) { alert(error.message); return; }
    setFName(""); setFStock(""); setFMin("3"); setFCost(""); setFPrice("");
    setShowAdd(null);
    router.refresh();
  };

  return (
    <div className="pb-24">
      <div className="mb-4 overflow-hidden rounded-2xl border border-[#EF4444]/30 bg-[#140A0A]">
        <div className="flex items-center gap-3 bg-gradient-to-r from-[#EF4444]/20 to-transparent px-4 py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EF4444]/20">
            <Wrench size={20} className="text-[#EF4444]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#F0EFF8]">Rak Spare Part Bengkel</p>
            <p className="text-[11px] text-[#8B8AA0]">Oli · ban · aki — keluar = dipasang ke kendaraan</p>
          </div>
          <Link href="/dashboard/bengkel" className="rounded-full border border-[#EF4444]/30 px-3 py-1.5 text-xs text-[#EF4444]">Antrian →</Link>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-white/[0.06] bg-white/[0.03]">
          <div className="bg-[#140A0A] p-3"><p className="text-[10px] text-[#8B8AA0]">Spare part</p><p className="font-mono text-lg font-semibold text-[#EF4444]">{products.length}</p></div>
          <div className="bg-[#140A0A] p-3"><p className="text-[10px] text-[#8B8AA0]">Stok kritis</p><p className="font-mono text-lg font-semibold text-[#F59E0B]">{kritis.length}</p></div>
        </div>
      </div>

      <RecentMovementsStrip movements={movements} accent={ACCENT} />

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5B7A]" />
        <input className={`${inputCls} pl-9`} placeholder="Cari spare part..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {products.length === 0 && !showAdd && (
        <FnbEmptyState
          icon={Wrench}
          title="Rak part kosong"
          subtitle="Isi oli, ban, filter, dll. Saat pasang ke kendaraan → tombol Dipasang."
          actionLabel="Tambah part"
          onAction={() => {
            setFCat("Oli");
            setShowAdd("oli");
          }}
        />
      )}

      <div className="space-y-4">
        {RACKS.map((rack) => {
          const items = filtered.filter((p) => rack.cats.includes(p.category || ""));
          if (items.length === 0 && search && showAdd !== rack.key) return null;
          if (products.length === 0 && showAdd !== rack.key && showAdd !== null) return null;
          if (products.length === 0 && showAdd === null) return null;
          return (
            <section key={rack.key} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#100808]">
              <div className="flex items-center justify-between px-4 py-3" style={{ borderLeft: `4px solid ${rack.color}`, background: `${rack.color}12` }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: rack.color }}>{rack.label}</p>
                  <p className="text-[10px] text-[#5A5B7A]">{items.length} part</p>
                </div>
                <button type="button" onClick={() => { setFCat(rack.cats[0]); setShowAdd(rack.key); }}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[#070711]"
                  style={{ background: rack.color }}>
                  <Plus size={12} /> Part
                </button>
              </div>

              {showAdd === rack.key && (
                <div className="space-y-2 border-b border-white/[0.06] p-4">
                  <input className={inputCls} placeholder="Nama part *" value={fName} onChange={(e) => setFName(e.target.value)} autoFocus />
                  <select className={inputCls} value={fCat} onChange={(e) => setFCat(e.target.value)}>
                    {rack.cats.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <input className={inputCls} type="number" placeholder="Stok *" value={fStock} onChange={(e) => setFStock(e.target.value)} />
                    <input className={inputCls} type="number" placeholder="Min" value={fMin} onChange={(e) => setFMin(e.target.value)} />
                    <input className={inputCls} type="number" placeholder="Modal" value={fCost} onChange={(e) => setFCost(e.target.value)} />
                    <input className={inputCls} type="number" placeholder="Harga" value={fPrice} onChange={(e) => setFPrice(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={loading} onClick={() => handleAdd(rack.cats[0])} className="flex-1 rounded-xl py-2.5 text-sm font-semibold" style={BTN}>{loading ? "..." : "Simpan part"}</button>
                    <button type="button" onClick={() => setShowAdd(null)} className="rounded-xl border border-white/10 px-3 text-[#8B8AA0]"><X size={16} /></button>
                  </div>
                </div>
              )}

              {items.length === 0 ? (
                <p className="px-4 py-5 text-center text-xs text-[#5A5B7A]">Kosong</p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {items.map((p) => {
                    const low = Number(p.stock) <= Number(p.min_stock);
                    return (
                      <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-medium text-[#F0EFF8]">{p.name}</p>
                          <p className="text-[11px] text-[#8B8AA0]">
                            Stok <span className={low ? "text-[#F59E0B]" : "text-[#EF4444]"}>{p.stock}</span>
                            {p.price != null ? ` · ${fmtRp(Number(p.price))}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => { setActive(p); setSheet("masuk"); }} className="rounded-lg bg-[#2DD4BF]/10 px-2 py-1 text-[10px] text-[#2DD4BF]"><ArrowDownToLine size={11} className="inline" /> Masuk</button>
                          <button type="button" onClick={() => { setActive(p); setSheet("keluar"); }} className="rounded-lg bg-[#EF4444]/15 px-2 py-1 text-[10px] font-semibold text-[#EF4444]"><Wrench size={11} className="inline" /> Dipasang</button>
                          <button type="button" onClick={() => { setActive(p); setSheet("jual"); }} className="rounded-lg bg-[#F59E0B]/10 px-2 py-1 text-[10px] text-[#F59E0B]"><ShoppingCart size={11} className="inline" /> Jual</button>
                          <EditProductModal product={p as never} />
                          <DeleteTransactionButton id={p.id} table="products" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {sheet && active && (
        <StockActionSheet
          mode={sheet} product={active} onClose={() => { setSheet(null); setActive(null); }}
          userId={userId} businessId={businessId}
          buyCategory="Pembelian Spare Part" sellCategory="Penjualan Spare Part"
          reasons={[
            { value: "dipasang", label: "Dipasang ke kendaraan" },
            ...config.alasanKeluar,
          ]}
          accent={ACCENT}
          defaultReason={sheet === "keluar" ? "dipasang" : undefined}
        />
      )}
    </div>
  );
}
