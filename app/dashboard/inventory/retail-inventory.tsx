"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Store, Plus, Search, ArrowDownToLine, ArrowUpFromLine, ShoppingCart, X } from "lucide-react";
import { getConfig } from "./business-config";
import DeleteTransactionButton from "../delete-transaction-button";
import EditProductModal from "./edit-product-modal";
import FnbEmptyState from "../fnb/components/fnb-empty-state";
import { addProduct, fmtRp, type ProductRow, type StockMovementRow } from "./lib/typed-stock-actions";
import { RecentMovementsStrip, StockActionSheet, inputCls } from "./lib/inventory-ui-shared";

const ACCENT = "#38BDF8";
const BTN = { background: "linear-gradient(135deg, #38BDF8, #6366F1)", color: "#070711" } as const;

const RACKS = [
  { key: "fashion", label: "Fashion & Aksesoris", cats: ["Fashion", "Aksesoris"], color: "#38BDF8" },
  { key: "elektronik", label: "Elektronik", cats: ["Elektronik"], color: "#8B5CF6" },
  { key: "fmcg", label: "Makanan & Minuman", cats: ["Makanan", "Minuman"], color: "#F59E0B" },
  { key: "kosmetik", label: "Kosmetik & Perabot", cats: ["Kosmetik", "Perabot"], color: "#EC4899" },
];

export default function RetailInventory({
  products, userId, businessId, movements = [],
}: {
  products: ProductRow[];
  userId: string;
  businessId?: string;
  movements?: StockMovementRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const config = getConfig("retail");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"masuk" | "keluar" | "jual" | null>(null);
  const [active, setActive] = useState<ProductRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [fName, setFName] = useState("");
  const [fSku, setFSku] = useState("");
  const [fStock, setFStock] = useState("");
  const [fMin, setFMin] = useState("5");
  const [fPrice, setFPrice] = useState("");
  const [fCost, setFCost] = useState("");
  const [fCat, setFCat] = useState("Fashion");

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.sku || "").toLowerCase().includes(search.toLowerCase()),
      ),
    [products, search],
  );
  const kritis = products.filter((p) => Number(p.stock) <= Number(p.min_stock));

  const open = (mode: "masuk" | "keluar" | "jual", p: ProductRow) => {
    setActive(p);
    setSheet(mode);
  };

  const handleAdd = async (defaultCat: string) => {
    if (!fName.trim() || !fStock) return;
    if (!businessId) {
      alert("Bisnis aktif belum terpilih. Ganti bisnis di switcher sidebar, lalu coba lagi.");
      return;
    }
    setLoading(true);
    const { error } = await addProduct(supabase, {
      userId, businessId, name: fName, sku: fSku || null,
      category: fCat || defaultCat, stock: Number(fStock), minStock: Number(fMin) || 0,
      price: fPrice ? Number(fPrice) : null, cost: fCost ? Number(fCost) : null,
      unit: "pcs", buyCategory: "Pembelian Barang",
    });
    setLoading(false);
    if (error) { alert("Gagal tambah produk: " + error.message); return; }
    setFName(""); setFSku(""); setFStock(""); setFMin("5"); setFPrice(""); setFCost("");
    setShowAdd(null);
    router.refresh();
  };

  return (
    <div className="pb-24">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#38BDF8]/30 bg-[#38BDF8]/10 px-3 py-1.5 text-xs font-semibold text-[#38BDF8]">
          <Store size={13} /> Rak Toko Retail
        </div>
        <Link href="/dashboard/retail" className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#8B8AA0]">Pusat Retail →</Link>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          { label: "SKU", value: String(products.length), color: ACCENT },
          { label: "Kritis", value: String(kritis.length), color: kritis.length ? "#F59E0B" : "#8B8AA0" },
          { label: "Nilai jual", value: fmtRp(products.reduce((s, p) => s + Number(p.stock) * Number(p.price || 0), 0)), color: "#6366F1" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-[#38BDF8]/15 bg-[#0B1220] p-3">
            <p className="text-[10px] text-[#8B8AA0]">{k.label}</p>
            <p className="mt-1 truncate font-mono text-base font-semibold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <RecentMovementsStrip movements={movements} accent={ACCENT} />

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5B7A]" />
        <input className={`${inputCls} pl-9`} placeholder="Cari nama / SKU di rak..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {products.length === 0 && !showAdd && (
        <FnbEmptyState
          icon={Store}
          title="Rak masih kosong"
          subtitle="Tambah produk per rak kategori — seperti etalase toko."
          actionLabel="Tambah produk"
          onAction={() => {
            setFCat("Fashion");
            setShowAdd("fashion");
          }}
        />
      )}

      <div className="space-y-5">
        {RACKS.map((rack) => {
          const items = filtered.filter((p) => rack.cats.includes(p.category || ""));
          if (items.length === 0 && search && showAdd !== rack.key) return null;
          // Saat stok kosong, tetap tampilkan rak yang sedang diisi biar form "Tambah" kelihatan
          if (products.length === 0 && showAdd !== rack.key && showAdd !== null) return null;
          if (products.length === 0 && showAdd === null) return null;

          return (
            <section key={rack.key} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A1018]">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3" style={{ background: `${rack.color}10` }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: rack.color }}>{rack.label}</p>
                  <p className="text-[10px] text-[#5A5B7A]">{items.length} item di rak</p>
                </div>
                <button type="button" onClick={() => { setFCat(rack.cats[0]); setShowAdd(rack.key); }}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[#070711]"
                  style={{ background: rack.color }}>
                  <Plus size={12} /> Tambah
                </button>
              </div>

              {showAdd === rack.key && (
                <div className="space-y-2 border-b border-white/[0.06] p-4">
                  <input className={inputCls} placeholder="Nama produk *" value={fName} onChange={(e) => setFName(e.target.value)} autoFocus />
                  <input className={inputCls} placeholder="SKU / barcode" value={fSku} onChange={(e) => setFSku(e.target.value)} />
                  <div className="grid grid-cols-3 gap-2">
                    <input className={inputCls} type="number" placeholder="Stok *" value={fStock} onChange={(e) => setFStock(e.target.value)} />
                    <input className={inputCls} type="number" placeholder="Modal" value={fCost} onChange={(e) => setFCost(e.target.value)} />
                    <input className={inputCls} type="number" placeholder="Harga jual" value={fPrice} onChange={(e) => setFPrice(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={loading} onClick={() => handleAdd(rack.cats[0])} className="flex-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40" style={BTN}>
                      {loading ? "..." : "Simpan ke rak"}
                    </button>
                    <button type="button" onClick={() => setShowAdd(null)} className="rounded-xl border border-white/10 px-3 text-[#8B8AA0]"><X size={16} /></button>
                  </div>
                </div>
              )}

              {items.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-[#5A5B7A]">Belum ada di rak ini</p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {items.map((p) => {
                    const low = Number(p.stock) <= Number(p.min_stock);
                    return (
                      <div key={p.id} className="px-4 py-3">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#F0EFF8]">{p.name}</p>
                            <p className="text-[11px] text-[#8B8AA0]">
                              {p.sku ? `SKU ${p.sku} · ` : ""}Stok <span className={low ? "text-[#F59E0B]" : "text-[#38BDF8]"}>{p.stock}</span>
                              {p.price != null ? ` · ${fmtRp(Number(p.price))}` : ""}
                            </p>
                          </div>
                          {low && <span className="rounded-full bg-[#F59E0B]/15 px-2 py-0.5 text-[10px] text-[#F59E0B]">Kritis</span>}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => open("masuk", p)} className="inline-flex items-center gap-1 rounded-lg bg-[#38BDF8]/10 px-2 py-1 text-[10px] text-[#38BDF8]"><ArrowDownToLine size={11} /> Masuk</button>
                          <button type="button" onClick={() => open("keluar", p)} className="inline-flex items-center gap-1 rounded-lg bg-[#F59E0B]/10 px-2 py-1 text-[10px] text-[#F59E0B]"><ArrowUpFromLine size={11} /> Keluar</button>
                          <button type="button" onClick={() => open("jual", p)} className="inline-flex items-center gap-1 rounded-lg bg-[#6366F1]/10 px-2 py-1 text-[10px] text-[#6366F1]"><ShoppingCart size={11} /> Jual</button>
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
        {/* uncategorized */}
        {filtered.filter((p) => !RACKS.some((r) => r.cats.includes(p.category || ""))).length > 0 && (
          <section className="rounded-2xl border border-white/[0.08] bg-[#0A1018] p-4">
            <p className="mb-2 text-xs text-[#8B8AA0]">Lainnya</p>
            {filtered.filter((p) => !RACKS.some((r) => r.cats.includes(p.category || ""))).map((p) => (
              <div key={p.id} className="mb-2 flex items-center justify-between gap-2 border-b border-white/[0.04] py-2 last:border-0">
                <span className="text-sm">{p.name}</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => open("jual", p)} className="rounded-lg bg-[#6366F1]/10 px-2 py-1 text-[10px] text-[#6366F1]">Jual</button>
                  <EditProductModal product={p as never} />
                  <DeleteTransactionButton id={p.id} table="products" />
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      {sheet && active && (
        <StockActionSheet
          mode={sheet} product={active} onClose={() => { setSheet(null); setActive(null); }}
          userId={userId} businessId={businessId}
          buyCategory="Pembelian Barang" sellCategory="Penjualan"
          reasons={config.alasanKeluar} accent={ACCENT} qtyChips={[1, 2, 5, 10, 20]}
        />
      )}
    </div>
  );
}
