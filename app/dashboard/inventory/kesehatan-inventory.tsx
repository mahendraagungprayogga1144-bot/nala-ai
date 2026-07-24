"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { HeartPulse, Plus, Search, ArrowDownToLine, ArrowUpFromLine, ShoppingCart, X, AlertTriangle } from "lucide-react";
import { getConfig } from "./business-config";
import DeleteTransactionButton from "../delete-transaction-button";
import EditProductModal from "./edit-product-modal";
import FnbEmptyState from "../fnb/components/fnb-empty-state";
import {
  addProduct, daysUntil, fmtRp, type ProductAttr, type ProductRow, type StockMovementRow,
} from "./lib/typed-stock-actions";
import { RecentMovementsStrip, StockActionSheet, inputCls } from "./lib/inventory-ui-shared";

const ACCENT = "#10B981";
const BTN = { background: "linear-gradient(135deg, #10B981, #2DD4BF)", color: "#070711" } as const;

export default function KesehatanInventory({
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
  const config = getConfig("kesehatan");
  const attrMap = useMemo(() => Object.fromEntries(attrs.map((a) => [String(a.product_id), a])), [attrs]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "expired" | "soon" | "safe" | "kritis">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [sheet, setSheet] = useState<"masuk" | "keluar" | "jual" | null>(null);
  const [active, setActive] = useState<ProductRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [fName, setFName] = useState("");
  const [fSku, setFSku] = useState("");
  const [fCat, setFCat] = useState("Obat Bebas");
  const [fStock, setFStock] = useState("");
  const [fMin, setFMin] = useState("5");
  const [fCost, setFCost] = useState("");
  const [fPrice, setFPrice] = useState("");
  const [fExpiry, setFExpiry] = useState("");

  const withDays = useMemo(
    () =>
      products.map((p) => {
        const a = attrMap[p.id];
        const days = daysUntil(a?.expiry_date);
        return { p, a, days };
      }),
    [products, attrMap],
  );

  const expired = withDays.filter((x) => x.days != null && x.days < 0);
  const soon = withDays.filter((x) => x.days != null && x.days >= 0 && x.days <= 30);
  const kritis = products.filter((p) => Number(p.stock) <= Number(p.min_stock));

  const filtered = useMemo(() => {
    let list = withDays.filter(
      (x) =>
        x.p.name.toLowerCase().includes(search.toLowerCase()) ||
        (x.p.sku || "").toLowerCase().includes(search.toLowerCase()),
    );
    if (filter === "expired") list = list.filter((x) => x.days != null && x.days < 0);
    if (filter === "soon") list = list.filter((x) => x.days != null && x.days >= 0 && x.days <= 30);
    if (filter === "safe") list = list.filter((x) => x.days == null || x.days > 30);
    if (filter === "kritis") list = list.filter((x) => Number(x.p.stock) <= Number(x.p.min_stock));
    return list.sort((a, b) => {
      const ad = a.days ?? 9999;
      const bd = b.days ?? 9999;
      return ad - bd;
    });
  }, [withDays, search, filter]);

  const handleAdd = async () => {
    if (!fName.trim() || !fStock) return;
    setLoading(true);
    const { error } = await addProduct(supabase, {
      userId, businessId, name: fName, sku: fSku || null, category: fCat,
      stock: Number(fStock), minStock: Number(fMin) || 0,
      price: fPrice ? Number(fPrice) : null, cost: fCost ? Number(fCost) : null,
      unit: "pcs", buyCategory: "Pembelian Obat", attrsMode: "expiry",
      expiryDate: fExpiry || null,
    });
    setLoading(false);
    if (error) { alert(error.message); return; }
    setFName(""); setFSku(""); setFStock(""); setFMin("5"); setFCost(""); setFPrice(""); setFExpiry("");
    setShowAdd(false);
    router.refresh();
  };

  const edColor = (days: number | null) => {
    if (days == null) return "#5A5B7A";
    if (days < 0) return "#EC4899";
    if (days <= 30) return "#F59E0B";
    return "#10B981";
  };

  return (
    <div className="pb-24">
      <div className="mb-4 overflow-hidden rounded-2xl border border-[#10B981]/30 bg-[#0A1410]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#10B981]/15 px-4 py-3">
          <div className="flex items-center gap-2">
            <HeartPulse size={18} className="text-[#10B981]" />
            <div>
              <p className="text-sm font-semibold text-[#F0EFF8]">Stok Obat & Alkes</p>
              <p className="text-[11px] text-[#8B8AA0]">Prioritas kadaluarsa (ED) sebelum jual</p>
            </div>
          </div>
          <Link href="/dashboard/kesehatan" className="rounded-full border border-[#10B981]/30 px-3 py-1.5 text-xs text-[#10B981]">Pusat Kesehatan →</Link>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
          <div className="rounded-xl bg-[#10B981]/10 p-2.5 text-center"><p className="text-[10px] text-[#8B8AA0]">Item</p><p className="font-mono font-semibold text-[#10B981]">{products.length}</p></div>
          <div className="rounded-xl bg-[#EC4899]/10 p-2.5 text-center"><p className="text-[10px] text-[#8B8AA0]">Kadaluarsa</p><p className="font-mono font-semibold text-[#EC4899]">{expired.length}</p></div>
          <div className="rounded-xl bg-[#F59E0B]/10 p-2.5 text-center"><p className="text-[10px] text-[#8B8AA0]">≤30 hari</p><p className="font-mono font-semibold text-[#F59E0B]">{soon.length}</p></div>
          <div className="rounded-xl bg-white/5 p-2.5 text-center"><p className="text-[10px] text-[#8B8AA0]">Stok kritis</p><p className="font-mono font-semibold text-[#8B8AA0]">{kritis.length}</p></div>
        </div>
      </div>

      {(expired.length > 0 || soon.length > 0) && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#F59E0B]" />
          <p className="text-[11px] text-[#F59E0B]">
            {expired.length > 0 && `${expired.length} sudah kadaluarsa. `}
            {soon.length > 0 && `${soon.length} mendekati ED ≤30 hari. `}
            Filter di bawah untuk pantau.
          </p>
        </div>
      )}

      <RecentMovementsStrip movements={movements} accent={ACCENT} />

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {([
          { key: "all" as const, label: "Semua" },
          { key: "expired" as const, label: "Kadaluarsa" },
          { key: "soon" as const, label: "≤30 hari" },
          { key: "safe" as const, label: "Aman" },
          { key: "kritis" as const, label: "Stok kritis" },
        ]).map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
            className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium"
            style={filter === f.key ? { background: `${ACCENT}33`, color: ACCENT } : { background: "rgba(255,255,255,0.05)", color: "#8B8AA0" }}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5B7A]" />
          <input className={`${inputCls} pl-9`} placeholder="Cari obat / alkes..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 rounded-xl px-3 text-sm font-semibold" style={BTN}>
          <Plus size={14} /> + ED
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 space-y-2 rounded-2xl border border-[#10B981]/25 bg-[#0C1814] p-4">
          <input className={inputCls} placeholder="Nama obat/produk *" value={fName} onChange={(e) => setFName(e.target.value)} />
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
            <input className={inputCls} type="number" placeholder="Harga" value={fPrice} onChange={(e) => setFPrice(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[#8B8AA0]">Tanggal kadaluarsa (ED) — disarankan</label>
            <input className={inputCls} type="date" value={fExpiry} onChange={(e) => setFExpiry(e.target.value)} style={{ colorScheme: "dark" }} />
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={loading} onClick={handleAdd} className="flex-1 rounded-xl py-2.5 text-sm font-semibold" style={BTN}>{loading ? "..." : "Simpan + ED"}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-xl border border-white/10 px-3 text-[#8B8AA0]"><X size={16} /></button>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <FnbEmptyState icon={HeartPulse} title="Belum ada obat/alkes" subtitle="Tambah dengan tanggal ED supaya pantauan kadaluarsa jalan." actionLabel="Tambah item" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="space-y-2">
          {filtered.map(({ p, a, days }) => {
            const low = Number(p.stock) <= Number(p.min_stock);
            const color = edColor(days);
            return (
              <div key={p.id} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A1210]">
                <div className="h-1" style={{ background: color }} />
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#F0EFF8]">{p.name}</p>
                      <p className="text-[11px] text-[#8B8AA0]">{p.category}{p.sku ? ` · ${p.sku}` : ""} · Stok {p.stock}</p>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${color}22`, color }}>
                      {days == null ? "Belum ED" : days < 0 ? `ED −${Math.abs(days)}h` : days <= 30 ? `ED ${days}h` : `Aman ${days}h`}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px]" style={{ color }}>
                    {a?.expiry_date ? `ED ${a.expiry_date}` : "Isi ED lewat edit"}
                    {p.price != null ? ` · ${fmtRp(Number(p.price))}` : ""}
                    {low ? " · Stok kritis" : ""}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => { setActive(p); setSheet("masuk"); }} className="inline-flex items-center gap-1 rounded-lg bg-[#10B981]/10 px-2 py-1 text-[10px] text-[#10B981]"><ArrowDownToLine size={11} /> Masuk</button>
                    <button type="button" onClick={() => { setActive(p); setSheet("keluar"); }} className="inline-flex items-center gap-1 rounded-lg bg-[#F59E0B]/10 px-2 py-1 text-[10px] text-[#F59E0B]"><ArrowUpFromLine size={11} /> Keluar</button>
                    <button type="button" onClick={() => { setActive(p); setSheet("jual"); }} disabled={days != null && days < 0} className="inline-flex items-center gap-1 rounded-lg bg-[#2DD4BF]/10 px-2 py-1 text-[10px] text-[#2DD4BF] disabled:opacity-30"><ShoppingCart size={11} /> Jual</button>
                    <EditProductModal product={p as never} userId={userId} businessId={businessId} attrsMode="expiry" attr={a} />
                    <DeleteTransactionButton id={p.id} table="products" />
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
          buyCategory="Pembelian Obat" sellCategory="Penjualan"
          reasons={config.alasanKeluar} accent={ACCENT}
          defaultReason={sheet === "keluar" ? "rusak" : undefined}
        />
      )}
    </div>
  );
}
