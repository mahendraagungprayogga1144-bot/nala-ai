"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Search, Trash2, ArrowLeftRight, Edit2, ShoppingBag, AlertTriangle, X } from "lucide-react";
import { calcProductHpp, calcMarginPct, calcRecipeHppPerUnit, findRecipeForProduct, fmtRp, type HiRecipe } from "./home-industry-calc";

type Product = { id: string; name: string; sku: string | null; stock: number; min_stock: number; price: number | null; cost: number | null; category: string | null; photo_url: string | null };

const KATEGORI = ["Bahan Baku", "Bahan Pendukung", "Kemasan", "Produk Jadi", "Alat"];
const SATUAN_OPTIONS = ["kg", "gram", "liter", "ml", "pcs", "lusin", "loyang", "bungkus", "karung", "botol", "unit"];
const KATEGORI_COLOR: Record<string, string> = { "Bahan Baku": "#1D9E75", "Bahan Pendukung": "#7F77DD", "Kemasan": "#BA7517", "Produk Jadi": "#2DD4BF", "Alat": "#6366F1" };
const KATEGORI_BG: Record<string, string> = { "Bahan Baku": "#E1F5EE", "Bahan Pendukung": "#EEEDFE", "Kemasan": "#FAEEDA", "Produk Jadi": "#E1F5EE", "Alat": "#EEEDFE" };
const KATEGORI_ICON: Record<string, string> = { "Bahan Baku": "🌾", "Bahan Pendukung": "🧂", "Kemasan": "📦", "Produk Jadi": "🍪", "Alat": "🔧" };
const inputCls = "w-full px-3 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50 text-sm";

type FormProps = {
  kat: string; editProduct: Product | null;
  fNama: string; setFNama: (v: string) => void;
  fStok: string; setFStok: (v: string) => void;
  fSatuan: string; setFSatuan: (v: string) => void;
  fHargaBeli: string; setFHargaBeli: (v: string) => void;
  fHargaJual: string; setFHargaJual: (v: string) => void;
  fMinStok: string; setFMinStok: (v: string) => void;
  fSku: string; setFSku: (v: string) => void;
  formLoading: boolean;
  onSave: () => void; onCancel: () => void;
};

function AddForm({ kat, editProduct, fNama, setFNama, fStok, setFStok, fSatuan, setFSatuan, fHargaBeli, setFHargaBeli, fHargaJual, setFHargaJual, fMinStok, setFMinStok, fSku, setFSku, formLoading, onSave, onCancel, recipes }: FormProps & { recipes: HiRecipe[] }) {
  const color = KATEGORI_COLOR[kat] || "#8B8AA0";
  const isProdukJadi = kat === "Produk Jadi";
  const recipeHpp = isProdukJadi && fNama ? calcRecipeHppPerUnit(findRecipeForProduct(fNama, recipes) || { id: "", name: "", yield_quantity: 1, recipe_ingredients: [] }) : 0;
  const hppUsed = isProdukJadi && recipeHpp > 0 ? recipeHpp : (fHargaBeli ? Number(fHargaBeli) : 0);
  const laba = fHargaJual && hppUsed ? Number(fHargaJual) - hppUsed : null;
  const margin = laba !== null && hppUsed > 0 ? Math.round(laba / Number(fHargaJual) * 100) : null;
  return (
    <div className="mx-4 mb-3 rounded-xl p-4 bg-[#0A0A12]" style={{ border: "1px solid " + color + "25" }}>
      <p className="text-xs font-medium mb-3" style={{ color }}>{editProduct ? "Edit" : "Tambah"} {kat}</p>
      <div className="flex flex-col gap-2">
        <input className={inputCls} placeholder={"Nama " + kat.toLowerCase()} value={fNama} onChange={e => setFNama(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} type="number" placeholder="Stok" value={fStok} onChange={e => setFStok(e.target.value)} />
          <select className={inputCls} value={fSatuan} onChange={e => setFSatuan(e.target.value)}>
            {SATUAN_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {!isProdukJadi && (
            <input className={inputCls} type="number" placeholder="Harga beli/satuan (Rp)" value={fHargaBeli} onChange={e => setFHargaBeli(e.target.value)} />
          )}
          {isProdukJadi && (
            <div className={inputCls + " flex items-center text-xs text-[#8B8AA0]"}>
              {recipeHpp > 0 ? `HPP otomatis: ${fmtRp(Math.round(recipeHpp))}` : "HPP dari resep Produksi"}
            </div>
          )}
          <input className={inputCls} type="number" placeholder="Harga jual/satuan (Rp)" value={fHargaJual} onChange={e => setFHargaJual(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} type="number" placeholder="Min. stok" value={fMinStok} onChange={e => setFMinStok(e.target.value)} />
          <input className={inputCls} placeholder="SKU (opsional)" value={fSku} onChange={e => setFSku(e.target.value)} />
        </div>
        {isProdukJadi && laba !== null && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: laba >= 0 ? "#2DD4BF15" : "#EC489915", border: "1px solid " + (laba >= 0 ? "#2DD4BF" : "#EC4899") + "30" }}>
            <div className="flex justify-between mb-1"><span style={{ color: "#8B8AA0" }}>HPP/unit</span><span>{fmtRp(Math.round(hppUsed))}</span></div>
            <div className="flex justify-between mb-1"><span style={{ color: "#8B8AA0" }}>Harga jual</span><span>{fmtRp(Number(fHargaJual))}</span></div>
            <div className="flex justify-between font-medium" style={{ color: laba >= 0 ? "#2DD4BF" : "#EC4899" }}>
              <span>{laba >= 0 ? "Margin" : "Jual Rugi!"}</span><span>{fmtRp(Math.abs(laba))}{margin !== null ? ` (${Math.abs(margin)}%)` : ""}</span>
            </div>
          </div>
        )}
        <div className="flex gap-2 mt-1">
          <button onClick={onSave} disabled={formLoading} className="flex-1 py-2 rounded-lg text-[#0A0A12] font-semibold text-sm disabled:opacity-50" style={{ background: "linear-gradient(to right, #38BDF8, #8B5CF6)" }}>
            {formLoading ? "Menyimpan..." : "Simpan"}
          </button>
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-[#8B8AA0]">Batal</button>
        </div>
      </div>
    </div>
  );
}

export default function HomeIndustryInventory({ products, recipes, userId, businessId, profitHariIni, penjualanHariIni, hppHariIni }: {
  products: Product[]; recipes: HiRecipe[]; userId: string; businessId?: string;
  profitHariIni: number; penjualanHariIni: number; hppHariIni: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Semua");
  const [showForm, setShowForm] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [movingProduct, setMovingProduct] = useState<Product | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [fNama, setFNama] = useState("");
  const [fKategori, setFKategori] = useState("Bahan Baku");
  const [fStok, setFStok] = useState("");
  const [fSatuan, setFSatuan] = useState("kg");
  const [fHargaBeli, setFHargaBeli] = useState("");
  const [fHargaJual, setFHargaJual] = useState("");
  const [fMinStok, setFMinStok] = useState("5");
  const [fSku, setFSku] = useState("");
  const [moveType, setMoveType] = useState<"masuk" | "keluar">("masuk");
  const [moveQty, setMoveQty] = useState("");
  const [moveReason, setMoveReason] = useState("terjual");
  const [moveDate, setMoveDate] = useState(new Date().toISOString().split("T")[0]);
  const [moveNote, setMoveNote] = useState("");
  const [moveLoading, setMoveLoading] = useState(false);
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  const [sellQty, setSellQty] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellLoading, setSellLoading] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const resetForm = () => { setFNama(""); setFStok(""); setFSatuan("kg"); setFHargaBeli(""); setFHargaJual(""); setFMinStok("5"); setFSku(""); setEditProduct(null); };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && (activeTab === "Semua" || p.category === activeTab));
  const byKategori = (kat: string) => filtered.filter(p => p.category === kat);
  const lainnya = filtered.filter(p => !KATEGORI.includes(p.category || ""));

  const handleSave = async () => {
    if (!fNama || !fStok) return;
    setFormLoading(true);
    const isProdukJadi = fKategori === "Produk Jadi";
    const recipeHpp = isProdukJadi ? calcRecipeHppPerUnit(findRecipeForProduct(fNama, recipes) || { id: "", name: "", yield_quantity: 1, recipe_ingredients: [] }) : 0;
    const costValue = isProdukJadi
      ? (recipeHpp > 0 ? recipeHpp : (fHargaBeli ? Number(fHargaBeli) : null))
      : (fHargaBeli ? Number(fHargaBeli) : null);
    const payload = { user_id: userId, business_id: businessId, name: fNama, category: fKategori, stock: Number(fStok), min_stock: Number(fMinStok), cost: costValue, price: fHargaJual ? Number(fHargaJual) : null, sku: fSku || null };
    if (editProduct) { await supabase.from("products").update(payload).eq("id", editProduct.id); }
    else { await supabase.from("products").insert(payload); }
    setFormLoading(false); resetForm(); setShowForm(null); router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus item ini?")) return;
    await supabase.from("weight_logs").delete().eq("product_id", id);
    await supabase.from("health_schedules").delete().eq("product_id", id);
    await supabase.from("stock_movements").delete().eq("product_id", id);
    await supabase.from("harvest_batches").delete().eq("product_id", id);
    await supabase.from("recipe_ingredients").delete().eq("material_id", id);
    await supabase.from("recipes").delete().eq("product_id", id);
    await supabase.from("products").delete().eq("id", id);
    router.refresh();
  };

  const handleMove = async () => {
    if (!movingProduct || !moveQty) return;
    setMoveLoading(true);
    const qty = Number(moveQty);
    const newStock = moveType === "masuk" ? movingProduct.stock + qty : Math.max(0, movingProduct.stock - qty);
    const isProdukJadi = movingProduct.category === "Produk Jadi";
    const isSell = moveReason === "terjual";
    const profitLoss = moveType === "keluar" && isSell && movingProduct.price && movingProduct.cost ? (movingProduct.price - movingProduct.cost) * qty : 0;
    await supabase.from("products").update({ stock: newStock }).eq("id", movingProduct.id);
    await supabase.from("stock_movements").insert({ user_id: userId, product_id: movingProduct.id, type: moveType, reason: moveType === "keluar" ? moveReason : null, quantity: qty, note: moveNote || null, profit_loss: profitLoss, movement_date: moveDate });
    if (moveType === "keluar" && isSell && movingProduct.price) {
      await supabase.from("transactions").insert({ user_id: userId, business_id: businessId, type: "pemasukan", scope: "bisnis", category: isProdukJadi ? "Penjualan Produk" : "Penjualan", description: "Jual " + movingProduct.name + " (" + qty + ")", amount: movingProduct.price * qty, transaction_date: moveDate });
    } else if (moveType === "masuk" && movingProduct.cost) {
      await supabase.from("transactions").insert({ user_id: userId, business_id: businessId, type: "pengeluaran", scope: "bisnis", category: "Pembelian Bahan", description: "Beli " + movingProduct.name + " (" + qty + ")", amount: movingProduct.cost * qty, transaction_date: moveDate });
    }
    setMoveLoading(false); setMovingProduct(null); setMoveQty(""); setMoveNote(""); router.refresh();
  };

  const openSell = (p: Product) => {
    setSellingProduct(p);
    setSellQty("1");
    setSellPrice(p.price?.toString() || "");
  };

  const handleJual = async () => {
    if (!sellingProduct || !sellQty || !sellPrice || !businessId) return;
    const qty = Number(sellQty);
    const harga = Number(sellPrice);
    if (qty <= 0 || harga <= 0) return;
    if (qty > sellingProduct.stock) { alert("Stok tidak cukup! Tersedia: " + sellingProduct.stock); return; }

    setSellLoading(true);
    const hpp = calcProductHpp(sellingProduct, recipes);
    const totalJual = qty * harga;
    const totalHpp = qty * hpp;
    const newStock = Math.max(0, sellingProduct.stock - qty);

    await supabase.from("products").update({ stock: newStock }).eq("id", sellingProduct.id);
    await supabase.from("stock_movements").insert({
      user_id: userId, product_id: sellingProduct.id, type: "keluar", reason: "terjual",
      quantity: qty, note: "Penjualan " + sellingProduct.name, profit_loss: totalJual - totalHpp, movement_date: today,
    });
    await supabase.from("transactions").insert({
      user_id: userId, business_id: businessId,
      type: "pemasukan", scope: "bisnis", category: "Penjualan",
      description: "Jual " + sellingProduct.name + " x" + qty,
      amount: totalJual, transaction_date: today,
    });
    await supabase.from("transactions").insert({
      user_id: userId, business_id: businessId,
      type: "pengeluaran", scope: "bisnis", category: "HPP",
      description: "HPP " + sellingProduct.name + " x" + qty,
      amount: totalHpp, transaction_date: today,
    });

    setSellLoading(false);
    setSellingProduct(null);
    setSellQty("");
    setSellPrice("");
    router.refresh();
  };

  const startEdit = (p: Product) => {
    setEditProduct(p); setFNama(p.name); setFKategori(p.category || "Bahan Baku"); setFStok(p.stock.toString());
    setFSatuan("pcs"); setFHargaBeli(p.cost?.toString() || ""); setFHargaJual(p.price?.toString() || "");
    setFMinStok(p.min_stock.toString()); setFSku(p.sku || ""); setShowForm(p.category || "Bahan Baku");
  };

  const nilaiStok = products.reduce((s, p) => s + (p.cost || 0) * p.stock, 0);
  const produkJadiCount = products.filter(p => p.category === "Produk Jadi").length;
  const kritisCount = products.filter(p => p.stock <= p.min_stock).length;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <div className="rounded-2xl border border-white/[0.08] p-4" style={{ background: "#0D0D1A" }}><p className="text-xs text-[#8B8AA0] mb-1">Total item</p><p className="text-lg font-mono font-semibold text-[#38BDF8]">{products.length}</p></div>
        <div className="rounded-2xl border border-white/[0.08] p-4" style={{ background: "#0D0D1A" }}><p className="text-xs text-[#8B8AA0] mb-1">Stok kritis</p><p className="text-lg font-mono font-semibold text-[#EC4899]">{kritisCount}</p></div>
        <div className="rounded-2xl border border-white/[0.08] p-4" style={{ background: "#0D0D1A" }}><p className="text-xs text-[#8B8AA0] mb-1">Nilai stok</p><p className="text-lg font-mono font-semibold text-[#2DD4BF]">{fmtRp(nilaiStok)}</p></div>
        <div className="rounded-2xl border border-white/[0.08] p-4" style={{ background: "#0D0D1A" }}><p className="text-xs text-[#8B8AA0] mb-1">Produk jadi</p><p className="text-lg font-mono font-semibold text-[#8B5CF6]">{produkJadiCount}</p></div>
        <div className="rounded-2xl border border-white/[0.08] p-4 col-span-2 sm:col-span-1" style={{ background: "#0D0D1A" }}>
          <p className="text-xs text-[#8B8AA0] mb-1">Profit hari ini</p>
          <p className="text-lg font-mono font-semibold" style={{ color: profitHariIni >= 0 ? "#2DD4BF" : "#EC4899" }}>{fmtRp(profitHariIni)}</p>
          <p className="text-[10px] text-[#5A5B7A] mt-0.5">Jual {fmtRp(penjualanHariIni)} · HPP {fmtRp(hppHariIni)}</p>
        </div>
      </div>
      <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8AA0]" />
            <input type="text" placeholder="Cari item..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] text-sm placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" />
          </div>
        </div>
        <div className="flex gap-2 px-4 py-2.5 border-b border-white/10 overflow-x-auto">
          {["Semua", ...KATEGORI].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={"text-[11px] px-3 py-1 rounded-full border whitespace-nowrap " + (activeTab === tab ? "bg-[#2DD4BF]/15 border-[#2DD4BF]/40 text-[#2DD4BF]" : "border-white/10 text-[#8B8AA0]")}>{tab}</button>
          ))}
        </div>
        {(activeTab === "Semua" ? KATEGORI : [activeTab]).map(kat => {
          const items = byKategori(kat);
          const color = KATEGORI_COLOR[kat] || "#8B8AA0";
          const isShowing = showForm === kat;
          return (
            <div key={kat} className="mb-2">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]" style={{ background: color + "08" }}>
                <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color }}>{kat + " (" + items.length + ")"}</span>
                <button onClick={() => { resetForm(); setFKategori(kat); setShowForm(isShowing && !editProduct ? null : kat); }} className="text-[10px] flex items-center gap-1 px-2.5 py-1 rounded-lg border" style={{ color, borderColor: color + "40", background: color + "10" }}>
                  <Plus size={10} /> Tambah
                </button>
              </div>
              {isShowing && (
                <AddForm kat={kat} editProduct={editProduct} recipes={recipes}
                  fNama={fNama} setFNama={setFNama} fStok={fStok} setFStok={setFStok}
                  fSatuan={fSatuan} setFSatuan={setFSatuan} fHargaBeli={fHargaBeli} setFHargaBeli={setFHargaBeli}
                  fHargaJual={fHargaJual} setFHargaJual={setFHargaJual} fMinStok={fMinStok} setFMinStok={setFMinStok}
                  fSku={fSku} setFSku={setFSku} formLoading={formLoading}
                  onSave={handleSave} onCancel={() => { resetForm(); setShowForm(null); }} />
              )}
              {items.length === 0 && !isShowing
                ? <p className="text-xs text-[#5A5B6A] text-center py-4">{"Belum ada " + kat.toLowerCase() + "."}</p>
                : items.map(p => {
                  const bg = KATEGORI_BG[p.category || ""] || "#F1EFE8";
                  const icon = KATEGORI_ICON[p.category || ""] || "📦";
                  const isKritis = p.stock <= p.min_stock;
                  const isProdukJadi = p.category === "Produk Jadi";
                  const hpp = isProdukJadi ? calcProductHpp(p, recipes) : Number(p.cost || 0);
                  const hargaJual = Number(p.price || 0);
                  const margin = isProdukJadi ? calcMarginPct(hargaJual, hpp) : null;
                  const isRugi = isProdukJadi && hpp > 0 && hargaJual > 0 && hpp > hargaJual;
                  const hasRecipe = isProdukJadi && !!findRecipeForProduct(p.name, recipes);

                  if (isProdukJadi) {
                    return (
                      <div key={p.id} className="px-4 py-3 border-b border-white/[0.04] last:border-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg" style={{ background: bg }}>{icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="text-sm font-medium">{p.name}</p>
                                {p.sku && <span className="text-[10px] text-[#8B8AA0] bg-white/5 px-1.5 py-0.5 rounded">{p.sku}</span>}
                                {isRugi && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EC4899]/15 text-[#EC4899] flex items-center gap-1">
                                    <AlertTriangle size={10} /> Jual Rugi!
                                  </span>
                                )}
                                {isKritis && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F59E0B]/15 text-[#F59E0B]">Stok kritis</span>}
                              </div>
                              <div className="rounded-xl border border-[#2DD4BF]/20 px-3 py-2 mt-1" style={{ background: "rgba(45,212,191,0.06)" }}>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                  <div>
                                    <p className="text-[9px] text-[#5A5B7A] uppercase">HPP/unit</p>
                                    <p className="text-xs font-mono font-semibold text-[#2DD4BF]">{hpp > 0 ? fmtRp(hpp) : "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-[#5A5B7A] uppercase">Harga jual</p>
                                    <p className="text-xs font-mono font-semibold text-[#F0EFF8]">{hargaJual > 0 ? fmtRp(hargaJual) : "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-[#5A5B7A] uppercase">Margin</p>
                                    <p className="text-xs font-mono font-semibold" style={{ color: margin !== null && margin >= 0 ? "#2DD4BF" : "#EC4899" }}>
                                      {margin !== null ? margin + "%" : "—"}
                                    </p>
                                  </div>
                                </div>
                                {!hasRecipe && hpp <= 0 && (
                                  <p className="text-[10px] text-[#F59E0B] mt-2 text-center">Buat resep di Produksi biar HPP akurat</p>
                                )}
                              </div>
                              <p className="text-[11px] text-[#8B8AA0] mt-1.5">Stok: <span className={isKritis ? "text-[#EC4899] font-mono" : "font-mono text-[#F0EFF8]"}>{p.stock}</span></p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => openSell(p)}
                              disabled={p.stock <= 0}
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-40"
                              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}
                            >
                              <ShoppingBag size={12} /> Jual
                            </button>
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setMovingProduct(p); setMoveType("masuk"); setMoveReason("terjual"); }} className="text-[#8B8AA0] hover:text-[#2DD4BF] p-1"><ArrowLeftRight size={14} /></button>
                              <button onClick={() => startEdit(p)} className="text-[#8B8AA0] hover:text-[#38BDF8] p-1"><Edit2 size={14} /></button>
                              <button onClick={() => handleDelete(p.id)} className="text-[#8B8AA0] hover:text-[#EC4899] p-1"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const laba = p.price && p.cost ? p.price - p.cost : null;
                  return (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg" style={{ background: bg }}>{icon}</div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium">{p.name}</p>
                            {p.sku && <span className="text-[10px] text-[#8B8AA0] bg-white/5 px-1.5 py-0.5 rounded">{p.sku}</span>}
                          </div>
                          <p className="text-[11px] text-[#8B8AA0]">
                            {p.cost ? "Beli Rp" + Number(p.cost).toLocaleString("id-ID") : ""}
                            {p.price ? " · Jual Rp" + Number(p.price).toLocaleString("id-ID") : ""}
                            {laba !== null && <span style={{ color: laba >= 0 ? "#2DD4BF" : "#EC4899" }}>{" · Laba Rp" + laba.toLocaleString("id-ID")}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={"font-mono font-semibold text-sm " + (isKritis ? "text-[#EC4899]" : "text-[#F2F1F8]")}>{p.stock}</p>
                          {isKritis && <p className="text-[10px] text-[#EC4899]">Stok kritis!</p>}
                        </div>
                        <button onClick={() => { setMovingProduct(p); setMoveType("masuk"); setMoveReason("terjual"); }} className="text-[#8B8AA0] hover:text-[#2DD4BF] p-1"><ArrowLeftRight size={14} /></button>
                        <button onClick={() => startEdit(p)} className="text-[#8B8AA0] hover:text-[#38BDF8] p-1"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(p.id)} className="text-[#8B8AA0] hover:text-[#EC4899] p-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          );
        })}
        {lainnya.length > 0 && lainnya.map(p => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
            <p className="text-sm">{p.name}</p><p className="text-sm font-mono">{p.stock}</p>
          </div>
        ))}
      </div>
      {movingProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setMovingProduct(null)}>
          <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">{"Stok — " + movingProduct.name}</h3>
              <button onClick={() => setMovingProduct(null)} className="text-[#8B8AA0]">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={() => setMoveType("masuk")} className={"py-2 rounded-lg text-sm font-medium border " + (moveType === "masuk" ? "bg-[#2DD4BF]/15 border-[#2DD4BF]/40 text-[#2DD4BF]" : "border-white/10 text-[#8B8AA0]")}>Masuk</button>
              <button onClick={() => setMoveType("keluar")} className={"py-2 rounded-lg text-sm font-medium border " + (moveType === "keluar" ? "bg-[#EC4899]/15 border-[#EC4899]/40 text-[#EC4899]" : "border-white/10 text-[#8B8AA0]")}>Keluar</button>
            </div>
            {moveType === "keluar" && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(movingProduct.category === "Produk Jadi"
                  ? [{ value: "terjual", label: "Terjual" }, { value: "rusak", label: "Cacat" }, { value: "lainnya", label: "Lainnya" }]
                  : [{ value: "terpakai", label: "Terpakai" }, { value: "rusak", label: "Rusak" }, { value: "lainnya", label: "Lainnya" }]
                ).map(o => <button key={o.value} onClick={() => setMoveReason(o.value)} className={"py-2 rounded-lg text-xs border " + (moveReason === o.value ? "border-[#EC4899]/40 bg-[#EC4899]/10 text-[#EC4899]" : "border-white/10 text-[#8B8AA0]")}>{o.label}</button>)}
              </div>
            )}
            <input className={inputCls + " mb-2"} type="number" placeholder="Jumlah" value={moveQty} onChange={e => setMoveQty(e.target.value)} />
            <div className="mb-2"><label className="text-[10px] text-[#8B8AA0] mb-1 block">Tanggal</label><input className={inputCls} type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} style={{ colorScheme: "dark" }} /></div>
            <input className={inputCls + " mb-3"} placeholder="Catatan (opsional)" value={moveNote} onChange={e => setMoveNote(e.target.value)} />
            <p className="text-[10px] text-[#5A5B6A] mb-3">Otomatis tercatat di Keuangan Bisnis</p>
            <button onClick={handleMove} disabled={moveLoading} className="w-full py-2.5 rounded-lg text-[#0A0A12] font-semibold text-sm disabled:opacity-50" style={{ background: "linear-gradient(to right, #38BDF8, #8B5CF6)" }}>{moveLoading ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </div>
      )}
      {sellingProduct && (() => {
        const hpp = calcProductHpp(sellingProduct, recipes);
        const qty = Number(sellQty) || 0;
        const harga = Number(sellPrice) || 0;
        const total = qty * harga;
        const totalHpp = qty * hpp;
        const laba = total - totalHpp;
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSellingProduct(null)}>
            <div className="rounded-2xl border border-white/10 p-5 w-full max-w-sm" style={{ background: "#0D0D1A" }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[#2DD4BF]">Catat Penjualan</p>
                  <h3 className="font-medium text-sm">{sellingProduct.name}</h3>
                </div>
                <button onClick={() => setSellingProduct(null)} className="text-[#8B8AA0]"><X size={18} /></button>
              </div>
              <p className="text-xs text-[#8B8AA0] mb-3">Stok tersedia: <span className="font-mono text-[#F0EFF8]">{sellingProduct.stock}</span> · HPP/unit: <span className="font-mono text-[#2DD4BF]">{fmtRp(hpp)}</span></p>
              <div className="flex flex-col gap-2 mb-3">
                <input className={inputCls} type="number" placeholder="Jumlah terjual" value={sellQty} onChange={e => setSellQty(e.target.value)} min={1} max={sellingProduct.stock} />
                <input className={inputCls} type="number" placeholder="Harga jual per unit (Rp)" value={sellPrice} onChange={e => setSellPrice(e.target.value)} />
              </div>
              {qty > 0 && harga > 0 && (
                <div className="rounded-xl border border-white/[0.08] px-3 py-2 mb-3 text-xs space-y-1" style={{ background: "#0A0A12" }}>
                  <div className="flex justify-between"><span className="text-[#8B8AA0]">Total jual</span><span className="font-mono text-[#F0EFF8]">{fmtRp(total)}</span></div>
                  <div className="flex justify-between"><span className="text-[#8B8AA0]">Total HPP</span><span className="font-mono text-[#EC4899]">{fmtRp(totalHpp)}</span></div>
                  <div className="flex justify-between font-medium border-t border-white/[0.06] pt-1"><span className="text-[#8B8AA0]">Laba</span><span className="font-mono" style={{ color: laba >= 0 ? "#2DD4BF" : "#EC4899" }}>{fmtRp(laba)}</span></div>
                </div>
              )}
              <button
                onClick={handleJual}
                disabled={sellLoading || !sellQty || !sellPrice}
                className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}
              >
                {sellLoading ? "Menyimpan..." : "Simpan Penjualan"}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
