"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Search, Plus, Package, AlertTriangle, ArrowDownToLine, ArrowUpFromLine,
  ShoppingCart, X, Filter, LayoutGrid, List,
} from "lucide-react";
import { todayWib } from "@/lib/date";
import FnbEmptyState from "../fnb/components/fnb-empty-state";
import DeleteTransactionButton from "../delete-transaction-button";
import EditProductModal from "./edit-product-modal";
import type { BusinessConfig } from "./business-config";

const BTN_GRAD = { background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" } as const;
const inputCls =
  "w-full px-3 py-2.5 rounded-xl bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50 text-sm";

export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  min_stock: number;
  price: number | null;
  cost: number | null;
  category: string | null;
  photo_url: string | null;
  unit?: string | null;
};

export type ProductAttr = {
  product_id: string;
  expiry_date?: string | null;
  min_order_qty?: number | null;
  wholesale_price?: number | null;
};

export type InventorySection = {
  key: string;
  label: string;
  cats: string[];
  defaultCat: string;
  accent: string;
};

export type TypedInventoryProps = {
  products: ProductRow[];
  userId: string;
  businessId?: string;
  config: BusinessConfig;
  tip: React.ReactNode;
  hubHref: string;
  hubLabel: string;
  sections: InventorySection[];
  buyCategory: string;
  sellCategory: string;
  showSku?: boolean;
  attrsMode?: "none" | "expiry" | "wholesale";
  attrs?: ProductAttr[];
  workflow?: [string, string, string];
};

function daysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function fmtRp(n: number) {
  if (n >= 1_000_000) return "Rp" + (n / 1_000_000).toFixed(1).replace(".0", "") + "jt";
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

function isSellReason(reason: string) {
  return reason === "terjual" || reason.startsWith("terjual");
}

export default function TypedInventory({
  products, userId, businessId, config, tip, hubHref, hubLabel, sections,
  buyCategory, sellCategory, showSku, attrsMode = "none", attrs = [],
  workflow = ["Tambah barang", "Cek & atur stok", "Keluar / jual"],
}: TypedInventoryProps) {
  const router = useRouter();
  const supabase = createClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "kritis" | string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showAdd, setShowAdd] = useState(false);
  const [sheet, setSheet] = useState<"masuk" | "keluar" | "jual" | null>(null);
  const [active, setActive] = useState<ProductRow | null>(null);
  const [loading, setLoading] = useState(false);

  // add form
  const [fName, setFName] = useState("");
  const [fSku, setFSku] = useState("");
  const [fCat, setFCat] = useState(sections[0]?.defaultCat || config.kategoriDefault[0] || "");
  const [fStock, setFStock] = useState("");
  const [fMin, setFMin] = useState("5");
  const [fPrice, setFPrice] = useState("");
  const [fCost, setFCost] = useState("");
  const [fUnit, setFUnit] = useState(config.satuanLabel.split("/")[0] || "pcs");
  const [fExpiry, setFExpiry] = useState("");
  const [fMoq, setFMoq] = useState("");
  const [fWprice, setFWprice] = useState("");

  // move / sell form
  const [qty, setQty] = useState("1");
  const [date, setDate] = useState(todayWib());
  const [note, setNote] = useState("");
  const [reason, setReason] = useState(config.alasanKeluar[0]?.value || "terjual");
  const [sellPrice, setSellPrice] = useState("");

  const attrMap = useMemo(() => Object.fromEntries(attrs.map((a) => [a.product_id, a])), [attrs]);

  const kritis = products.filter((p) => Number(p.stock) <= Number(p.min_stock));
  const nilaiModal = products.reduce((s, p) => s + Number(p.stock) * Number(p.cost || 0), 0);
  const nilaiJual = products.reduce((s, p) => s + Number(p.stock) * Number(p.price || 0), 0);
  const tanpaHarga = products.filter((p) => !p.price || Number(p.price) <= 0).length;

  const filtered = useMemo(() => {
    let list = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())
      || (p.sku || "").toLowerCase().includes(search.toLowerCase())
      || (p.category || "").toLowerCase().includes(search.toLowerCase()));
    if (filter === "kritis") list = list.filter((p) => Number(p.stock) <= Number(p.min_stock));
    else if (filter !== "all") {
      const sec = sections.find((s) => s.key === filter);
      if (sec) list = list.filter((p) => sec.cats.includes(p.category || ""));
    }
    return list.sort((a, b) => {
      const al = Number(a.stock) <= Number(a.min_stock) ? 0 : 1;
      const bl = Number(b.stock) <= Number(b.min_stock) ? 0 : 1;
      if (al !== bl) return al - bl;
      return a.name.localeCompare(b.name);
    });
  }, [products, search, filter, sections]);

  const resetAdd = () => {
    setFName(""); setFSku(""); setFStock(""); setFMin("5"); setFPrice(""); setFCost("");
    setFUnit(config.satuanLabel.split("/")[0] || "pcs");
    setFCat(sections[0]?.defaultCat || config.kategoriDefault[0] || "");
    setFExpiry(""); setFMoq(""); setFWprice("");
  };

  const openSheet = (mode: "masuk" | "keluar" | "jual", p: ProductRow) => {
    setActive(p);
    setSheet(mode);
    setQty(mode === "jual" && attrsMode === "wholesale" && attrMap[p.id]?.min_order_qty
      ? String(attrMap[p.id].min_order_qty)
      : "1");
    setDate(todayWib());
    setNote("");
    setReason(config.alasanKeluar[0]?.value || "terjual");
    const w = attrMap[p.id]?.wholesale_price;
    setSellPrice(mode === "jual" && attrsMode === "wholesale" && w != null
      ? String(w)
      : p.price != null ? String(p.price) : "");
  };

  const closeSheet = () => { setSheet(null); setActive(null); setLoading(false); };

  const handleAdd = async () => {
    if (!fName.trim() || !fStock) return;
    setLoading(true);
    const { data, error } = await supabase.from("products").insert({
      user_id: userId,
      business_id: businessId,
      name: fName.trim(),
      sku: showSku && fSku ? fSku.trim() : null,
      category: fCat || null,
      stock: Number(fStock),
      min_stock: Number(fMin) || 0,
      price: fPrice ? Number(fPrice) : null,
      cost: fCost ? Number(fCost) : null,
      unit: fUnit || null,
    }).select("id").single();

    if (error) { alert(error.message); setLoading(false); return; }

    if (data?.id && businessId && (attrsMode === "expiry" || attrsMode === "wholesale")) {
      await supabase.from("module_product_attrs").upsert({
        user_id: userId,
        business_id: businessId,
        product_id: data.id,
        expiry_date: attrsMode === "expiry" && fExpiry ? fExpiry : null,
        min_order_qty: attrsMode === "wholesale" && fMoq ? Number(fMoq) : null,
        wholesale_price: attrsMode === "wholesale" && fWprice ? Number(fWprice) : null,
      }, { onConflict: "business_id,product_id" });
    }

    // Beli masuk → otomatis catat pengeluaran kalau isi modal
    if (data?.id && fCost && Number(fStock) > 0) {
      await supabase.from("transactions").insert({
        user_id: userId, business_id: businessId,
        type: "pengeluaran", scope: "bisnis", category: buyCategory,
        description: `Stok awal ${fName.trim()} (${fStock} ${fUnit})`,
        amount: Number(fCost) * Number(fStock), transaction_date: todayWib(),
      });
      await supabase.from("stock_movements").insert({
        user_id: userId, product_id: data.id, type: "masuk",
        quantity: Number(fStock), note: "Stok awal", movement_date: todayWib(),
      });
    }

    setLoading(false);
    resetAdd();
    setShowAdd(false);
    router.refresh();
  };

  const handleMove = async () => {
    if (!active || !qty || Number(qty) <= 0) return;
    const q = Number(qty);
    if (sheet === "keluar" || sheet === "jual") {
      if (q > Number(active.stock)) { alert(`Stok tidak cukup. Tersedia: ${active.stock}`); return; }
    }
    setLoading(true);

    const isIn = sheet === "masuk";
    const newStock = isIn ? Number(active.stock) + q : Math.max(0, Number(active.stock) - q);
    const harga = Number(sellPrice) || Number(active.price) || 0;
    const modal = Number(active.cost) || 0;
    const laba = !isIn && (sheet === "jual" || isSellReason(reason)) && harga
      ? (harga - modal) * q
      : !isIn && reason === "rusak" && modal ? -modal * q : 0;

    const { error: stockErr } = await supabase.from("products").update({ stock: newStock }).eq("id", active.id);
    if (stockErr) { alert(stockErr.message); setLoading(false); return; }

    await supabase.from("stock_movements").insert({
      user_id: userId,
      product_id: active.id,
      type: isIn ? "masuk" : "keluar",
      reason: isIn ? null : (sheet === "jual" ? "terjual" : reason),
      quantity: q,
      note: note || (sheet === "jual" ? `Penjualan ${active.name}` : null),
      profit_loss: laba,
      movement_date: date,
    });

    if (isIn && modal > 0) {
      await supabase.from("transactions").insert({
        user_id: userId, business_id: businessId,
        type: "pengeluaran", scope: "bisnis", category: buyCategory,
        description: `Beli ${active.name} x${q}`,
        amount: modal * q, transaction_date: date,
      });
    } else if (!isIn && (sheet === "jual" || isSellReason(reason)) && harga > 0) {
      await supabase.from("transactions").insert({
        user_id: userId, business_id: businessId,
        type: "pemasukan", scope: "bisnis", category: sellCategory,
        description: `Jual ${active.name} x${q}`,
        amount: harga * q, transaction_date: date,
      });
    }

    closeSheet();
    router.refresh();
  };

  const marginPreview = fPrice && fCost
    ? Number(fPrice) - Number(fCost)
    : null;
  const marginPct = marginPreview != null && Number(fCost) > 0
    ? Math.round((marginPreview / Number(fCost)) * 100)
    : null;

  const sellQty = Number(qty) || 0;
  const sellHarga = Number(sellPrice) || 0;
  const sellModal = Number(active?.cost || 0);
  const sellTotal = sellQty * sellHarga;
  const sellLaba = sellQty * (sellHarga - sellModal);

  return (
    <div className="relative pb-24">
      {/* Hub + workflow */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={hubHref} className="rounded-full border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-3 py-1.5 text-xs font-medium text-[#2DD4BF]">
          {hubLabel} →
        </Link>
        <Link href="/dashboard/ai-kasir" className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#8B8AA0] hover:text-[#F0EFF8]">
          Kasir →
        </Link>
        <Link href="/dashboard/keuangan-bisnis" className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#8B8AA0] hover:text-[#F0EFF8]">
          Keuangan →
        </Link>
      </div>

      <div className="mb-5 overflow-hidden rounded-2xl border border-[#2DD4BF]/20 bg-[#13131F]/95">
        <div className="h-[2px] bg-gradient-to-r from-[#2DD4BF] via-[#8B5CF6] to-[#EC4899]" />
        <div className="grid grid-cols-3 gap-1 p-3">
          {workflow.map((w, i) => (
            <div key={w} className="rounded-xl bg-white/[0.03] px-2 py-2.5 text-center">
              <p className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#2DD4BF]/15 text-[11px] font-bold text-[#2DD4BF]">{i + 1}</p>
              <p className="text-[10px] leading-tight text-[#8B8AA0] sm:text-[11px]">{w}</p>
            </div>
          ))}
        </div>
        <p className="border-t border-white/[0.06] px-3 py-2 text-[11px] text-[#8B8AA0]">{tip}</p>
      </div>

      {/* KPI */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: config.kpiLabel.total, value: String(products.length), color: "#38BDF8" },
          { label: config.kpiLabel.lowStock, value: String(kritis.length), color: kritis.length ? "#F59E0B" : "#8B8AA0" },
          { label: "Nilai modal", value: fmtRp(nilaiModal), color: "#8B5CF6" },
          { label: "Nilai jual", value: fmtRp(nilaiJual), color: "#2DD4BF" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-3.5">
            <p className="text-[10px] text-[#8B8AA0]">{k.label}</p>
            <p className="mt-1 truncate font-mono text-base font-semibold sm:text-lg" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {(kritis.length > 0 || tanpaHarga > 0) && (
        <div className="mb-4 space-y-2">
          {kritis.length > 0 && (
            <button type="button" onClick={() => setFilter("kritis")}
              className="flex w-full items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-left">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
              <span className="text-[11px] text-amber-200">{kritis.length} item stok kritis — tap untuk filter.</span>
            </button>
          )}
          {tanpaHarga > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <Package size={14} className="mt-0.5 shrink-0 text-[#8B8AA0]" />
              <span className="text-[11px] text-[#8B8AA0]">{tanpaHarga} item belum punya harga jual.</span>
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5B7A]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={`Cari nama${showSku ? " / SKU" : ""} / kategori...`}
            className={`${inputCls} pl-9`} />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setView(view === "grid" ? "list" : "grid")}
            className="rounded-xl border border-white/10 p-2.5 text-[#8B8AA0]">
            {view === "grid" ? <List size={16} /> : <LayoutGrid size={16} />}
          </button>
          <button type="button" onClick={() => { resetAdd(); setShowAdd(true); }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold sm:flex-none" style={BTN_GRAD}>
            <Plus size={16} /> Tambah
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Filter size={14} className="mt-2 shrink-0 text-[#5A5B7A]" />
        {[
          { key: "all", label: "Semua" },
          { key: "kritis", label: `Kritis (${kritis.length})` },
          ...sections.map((s) => ({ key: s.key, label: s.label.split(" ")[0] })),
        ].map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium ${
              filter === f.key ? "bg-[#2DD4BF]/20 text-[#2DD4BF]" : "bg-white/5 text-[#8B8AA0]"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Add panel */}
      {showAdd && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-[#2DD4BF]/25 bg-[#0F0F1A]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <p className="text-sm font-semibold text-[#2DD4BF]">Tambah {config.produkLabel}</p>
            <button type="button" onClick={() => setShowAdd(false)} className="text-[#8B8AA0]"><X size={16} /></button>
          </div>
          <div className="space-y-2.5 p-4">
            <input className={inputCls} placeholder={`Nama ${config.produkLabel.toLowerCase()} *`} value={fName} onChange={(e) => setFName(e.target.value)} />
            {showSku && <input className={inputCls} placeholder="SKU / barcode (opsional)" value={fSku} onChange={(e) => setFSku(e.target.value)} />}
            <select className={inputCls} value={fCat} onChange={(e) => setFCat(e.target.value)}>
              {config.kategoriDefault.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <input className={inputCls} type="number" placeholder="Stok *" value={fStock} onChange={(e) => setFStock(e.target.value)} />
              <input className={inputCls} type="number" placeholder="Min stok" value={fMin} onChange={(e) => setFMin(e.target.value)} />
              <input className={inputCls} placeholder="Satuan" value={fUnit} onChange={(e) => setFUnit(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} type="number" placeholder="Modal / HPP" value={fCost} onChange={(e) => setFCost(e.target.value)} />
              <input className={inputCls} type="number" placeholder="Harga jual" value={fPrice} onChange={(e) => setFPrice(e.target.value)} />
            </div>
            {marginPreview != null && (
              <div className={`rounded-xl px-3 py-2 text-xs ${marginPreview >= 0 ? "bg-[#2DD4BF]/10 text-[#2DD4BF]" : "bg-[#EC4899]/10 text-[#EC4899]"}`}>
                Margin / unit: {fmtRp(marginPreview)} {marginPct != null ? `(${marginPct}%)` : ""}
                {fStock && fCost ? ` · Total modal stok: ${fmtRp(Number(fCost) * Number(fStock || 0))}` : ""}
              </div>
            )}
            {attrsMode === "expiry" && (
              <div>
                <label className="mb-1 block text-[11px] text-[#8B8AA0]">Tanggal kadaluarsa (ED)</label>
                <input className={inputCls} type="date" value={fExpiry} onChange={(e) => setFExpiry(e.target.value)} style={{ colorScheme: "dark" }} />
              </div>
            )}
            {attrsMode === "wholesale" && (
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} type="number" placeholder="MOQ (min. order)" value={fMoq} onChange={(e) => setFMoq(e.target.value)} />
                <input className={inputCls} type="number" placeholder="Harga grosir" value={fWprice} onChange={(e) => setFWprice(e.target.value)} />
              </div>
            )}
            <button type="button" disabled={loading || !fName || !fStock} onClick={handleAdd}
              className="w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-40" style={BTN_GRAD}>
              {loading ? "Menyimpan..." : "Simpan barang"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {products.length === 0 ? (
        <FnbEmptyState
          icon={Package}
          title={`Belum ada ${config.produkLabel.toLowerCase()}`}
          subtitle="Tap Tambah di atas — isi nama, stok, modal, harga. Siap jual."
          actionLabel="Tambah sekarang"
          onAction={() => { resetAdd(); setShowAdd(true); }}
        />
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-[#5A5B7A]">Tidak ada hasil untuk filter ini.</p>
      ) : (
        <div className={view === "grid" ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-2"}>
          {filtered.map((p) => {
            const low = Number(p.stock) <= Number(p.min_stock);
            const a = attrMap[p.id];
            const days = daysUntil(a?.expiry_date);
            const stockPct = p.min_stock > 0 ? Math.min(100, Math.round((Number(p.stock) / (Number(p.min_stock) * 3)) * 100)) : 100;
            const margin = p.price != null && p.cost != null ? Number(p.price) - Number(p.cost) : null;

            return (
              <div key={p.id} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0D0D1A]">
                <div className="flex gap-3 p-3.5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.04]">
                    {p.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package size={20} className="text-[#5A5B7A]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#F0EFF8]">{p.name}</p>
                        <p className="text-[11px] text-[#8B8AA0]">
                          {p.category || "—"}
                          {showSku && p.sku ? ` · ${p.sku}` : ""}
                          {p.unit ? ` · ${p.unit}` : ""}
                        </p>
                      </div>
                      {low && <span className="shrink-0 rounded-full bg-[#F59E0B]/15 px-2 py-0.5 text-[10px] text-[#F59E0B]">Kritis</span>}
                    </div>

                    <div className="mt-2">
                      <div className="mb-1 flex justify-between text-[11px]">
                        <span className={low ? "text-[#F59E0B]" : "text-[#2DD4BF]"}>Stok {Number(p.stock)}</span>
                        <span className="text-[#5A5B7A]">min {Number(p.min_stock)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full transition-all" style={{
                          width: `${Math.max(4, stockPct)}%`,
                          background: low ? "#F59E0B" : "#2DD4BF",
                        }} />
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[#8B8AA0]">
                      <span>Jual {p.price != null ? fmtRp(Number(p.price)) : "—"}</span>
                      <span>Modal {p.cost != null ? fmtRp(Number(p.cost)) : "—"}</span>
                      {margin != null && (
                        <span className={margin >= 0 ? "text-[#2DD4BF]" : "text-[#EC4899]"}>
                          {margin >= 0 ? "+" : ""}{fmtRp(margin)}
                        </span>
                      )}
                    </div>

                    {attrsMode === "expiry" && (
                      <p className={`mt-1 text-[11px] ${days != null && days < 0 ? "text-[#EC4899]" : days != null && days <= 30 ? "text-[#F59E0B]" : "text-[#5A5B7A]"}`}>
                        {a?.expiry_date
                          ? (days != null && days < 0 ? `Kadaluarsa ${Math.abs(days)}h` : `ED ${a.expiry_date}${days != null ? ` · ${days}h` : ""}`)
                          : "Belum set ED"}
                      </p>
                    )}
                    {attrsMode === "wholesale" && (
                      <p className="mt-1 text-[11px] text-[#38BDF8]">
                        MOQ {a?.min_order_qty ?? "—"} · Grosir {a?.wholesale_price != null ? fmtRp(Number(a.wholesale_price)) : "—"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-px border-t border-white/[0.06] bg-white/[0.03]">
                  <button type="button" onClick={() => openSheet("masuk", p)}
                    className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] text-[#2DD4BF] hover:bg-[#2DD4BF]/5">
                    <ArrowDownToLine size={14} /> Masuk
                  </button>
                  <button type="button" onClick={() => openSheet("keluar", p)}
                    className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] text-[#F59E0B] hover:bg-[#F59E0B]/5">
                    <ArrowUpFromLine size={14} /> Keluar
                  </button>
                  <button type="button" onClick={() => openSheet("jual", p)}
                    className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] text-[#8B5CF6] hover:bg-[#8B5CF6]/5">
                    <ShoppingCart size={14} /> Jual
                  </button>
                  <div className="flex items-center justify-center gap-1 py-1">
                    <EditProductModal product={p as never} />
                    <DeleteTransactionButton id={p.id} table="products" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom sheet: masuk / keluar / jual */}
      {sheet && active && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={closeSheet}>
          <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#12121f] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#5A5B7A]">
                  {sheet === "masuk" ? "Barang masuk" : sheet === "jual" ? "Jual barang" : "Barang keluar"}
                </p>
                <p className="font-semibold text-[#F0EFF8]">{active.name}</p>
                <p className="text-[11px] text-[#8B8AA0]">Stok sekarang: {Number(active.stock)} {active.unit || ""}</p>
              </div>
              <button type="button" onClick={closeSheet} className="text-[#8B8AA0]"><X size={18} /></button>
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-[#8B8AA0]">Jumlah *</label>
                  <input className={inputCls} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#8B8AA0]">Tanggal</label>
                  <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ colorScheme: "dark" }} />
                </div>
              </div>

              {/* Quick qty chips — kecil & partai */}
              <div className="flex flex-wrap gap-1.5">
                {(attrsMode === "wholesale"
                  ? [1, 5, 10, 20, 50, 100, Number(attrMap[active.id]?.min_order_qty || 0)].filter((n, i, a) => n > 0 && a.indexOf(n) === i)
                  : [1, 2, 5, 10, 20]
                ).map((n) => (
                  <button key={n} type="button" onClick={() => setQty(String(n))}
                    className={`rounded-lg px-2.5 py-1 text-[11px] ${qty === String(n) ? "bg-[#2DD4BF]/20 text-[#2DD4BF]" : "bg-white/5 text-[#8B8AA0]"}`}>
                    {n}
                  </button>
                ))}
              </div>

              {sheet === "keluar" && (
                <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>
                  {config.alasanKeluar.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              )}

              {sheet === "jual" && (
                <div>
                  <label className="mb-1 block text-[11px] text-[#8B8AA0]">
                    Harga jual / unit {attrsMode === "wholesale" ? "(bisa pakai harga grosir)" : ""}
                  </label>
                  <input className={inputCls} type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
                </div>
              )}

              <input className={inputCls} placeholder="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} />

              {sheet === "jual" && sellQty > 0 && sellHarga > 0 && (
                <div className="rounded-xl border border-[#2DD4BF]/20 bg-[#2DD4BF]/[0.06] p-3 text-xs">
                  <div className="flex justify-between text-[#8B8AA0]"><span>Total jual</span><span className="font-mono text-[#F0EFF8]">{fmtRp(sellTotal)}</span></div>
                  <div className="mt-1 flex justify-between text-[#8B8AA0]"><span>HPP</span><span className="font-mono">{fmtRp(sellModal * sellQty)}</span></div>
                  <div className={`mt-1 flex justify-between font-semibold ${sellLaba >= 0 ? "text-[#2DD4BF]" : "text-[#EC4899]"}`}>
                    <span>{sellLaba >= 0 ? "Laba" : "Rugi"}</span>
                    <span className="font-mono">{fmtRp(Math.abs(sellLaba))}</span>
                  </div>
                </div>
              )}

              <button type="button" disabled={loading} onClick={handleMove}
                className="w-full rounded-xl py-3.5 text-sm font-semibold disabled:opacity-40" style={BTN_GRAD}>
                {loading ? "Memproses..." : sheet === "masuk" ? "Catat masuk" : sheet === "jual" ? "Simpan penjualan" : "Catat keluar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
