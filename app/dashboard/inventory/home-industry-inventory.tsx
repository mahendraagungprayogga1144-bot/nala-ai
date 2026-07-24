"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Plus, Search, Trash2, ArrowLeftRight, Edit2, ShoppingBag, AlertTriangle, X, Check } from "lucide-react";
import { calcProductHpp, calcMarginPct, calcRecipeHppPerUnit, findRecipeForProduct, fmtRp, stockValue, todayWib, type HiRecipe } from "./home-industry-calc";
import HomeIndustryHubNav from "./home-industry-hub-nav";
import HomeIndustryStockAlerts from "./home-industry-stock-alerts";
import HomeIndustryRecentSales from "./home-industry-recent-sales";
import FnbEmptyState from "../fnb/components/fnb-empty-state";

type Product = { id: string; name: string; sku: string | null; stock: number; min_stock: number; price: number | null; cost: number | null; category: string | null; photo_url: string | null };

const KATEGORI = ["Bahan Baku", "Bahan Pendukung", "Kemasan", "Produk Jadi", "Alat"];
const SATUAN_OPTIONS = ["kg", "gram", "liter", "ml", "pcs", "lusin", "loyang", "bungkus", "karung", "botol", "unit"];
const KATEGORI_COLOR: Record<string, string> = { "Bahan Baku": "#2DD4BF", "Bahan Pendukung": "#8B5CF6", "Kemasan": "#F59E0B", "Produk Jadi": "#EC4899", "Alat": "#6366F1" };
const inputCls = "w-full px-3 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50 text-sm";
const BTN_GRAD = { background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" } as const;

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
          <button onClick={onSave} disabled={formLoading} className="flex-1 py-2 rounded-lg font-semibold text-sm disabled:opacity-50" style={BTN_GRAD}>
            {formLoading ? "Menyimpan..." : "Simpan"}
          </button>
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-[#8B8AA0]">Batal</button>
        </div>
      </div>
    </div>
  );
}

export default function HomeIndustryInventory({ products, recipes, userId, businessId, profitHariIni, penjualanHariIni, hppHariIni, todaySales, today: todayProp }: {
  products: Product[]; recipes: HiRecipe[]; userId: string; businessId?: string;
  profitHariIni: number; penjualanHariIni: number; hppHariIni: number;
  todaySales: { description: string | null; amount: number }[];
  today: string;
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
  const [moveReason, setMoveReason] = useState("terpakai");
  const [moveDate, setMoveDate] = useState(todayProp || todayWib());
  const [moveNote, setMoveNote] = useState("");
  const [moveLoading, setMoveLoading] = useState(false);
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  const [sellQty, setSellQty] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellLoading, setSellLoading] = useState(false);
  const [sellSuccess, setSellSuccess] = useState<{ nama: string; total: number; laba: number } | null>(null);
  const [formError, setFormError] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const today = todayProp || todayWib();

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
    const { error } = editProduct
      ? await supabase.from("products").update(payload).eq("id", editProduct.id)
      : await supabase.from("products").insert(payload);
    setFormLoading(false);
    if (error) {
      alert("Gagal simpan: " + error.message);
      return;
    }
    resetForm(); setShowForm(null); router.refresh();
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
    const isProdukJadi = movingProduct.category === "Produk Jadi";
    if (isProdukJadi && moveType === "keluar" && moveReason === "terjual") {
      alert("Untuk jual produk jadi, pakai tombol Jual ya — biar HPP & profit kehitung otomatis.");
      return;
    }
    setMoveLoading(true);
    setFormError("");
    const qty = Number(moveQty);
    const newStock = moveType === "masuk" ? movingProduct.stock + qty : Math.max(0, movingProduct.stock - qty);
    const isSell = moveReason === "terjual";
    const hppUnit = isProdukJadi ? calcProductHpp(movingProduct, recipes) : Number(movingProduct.cost || 0);
    const profitLoss = moveType === "keluar" && isSell && movingProduct.price ? (movingProduct.price - hppUnit) * qty : 0;

    const prevStock = movingProduct.stock;
    const { error: stockErr } = await supabase.from("products").update({ stock: newStock }).eq("id", movingProduct.id).eq("stock", prevStock);
    if (stockErr) { alert("Gagal update stok: " + stockErr.message); setMoveLoading(false); return; }

    const { error: movErr } = await supabase.from("stock_movements").insert({ user_id: userId, product_id: movingProduct.id, type: moveType, reason: moveType === "keluar" ? moveReason : null, quantity: qty, note: moveNote || null, profit_loss: profitLoss, movement_date: moveDate });
    if (movErr) {
      await supabase.from("products").update({ stock: prevStock }).eq("id", movingProduct.id);
      alert("Gagal catat mutasi: " + movErr.message);
      setMoveLoading(false);
      return;
    }

    if (moveType === "masuk" && movingProduct.cost) {
      const { error: txErr } = await supabase.from("transactions").insert({ user_id: userId, business_id: businessId, type: "pengeluaran", scope: "bisnis", category: "Pembelian Bahan", description: "Beli " + movingProduct.name + " (" + qty + ")", amount: movingProduct.cost * qty, transaction_date: moveDate });
      if (txErr) {
        await supabase.from("products").update({ stock: prevStock }).eq("id", movingProduct.id);
        alert("Stok dibatalkan — keuangan gagal: " + txErr.message);
        setMoveLoading(false);
        return;
      }
    }
    setMoveLoading(false); setMovingProduct(null); setMoveQty(""); setMoveNote(""); router.refresh();
  };

  const openMove = (p: Product) => {
    setMovingProduct(p);
    setMoveType("masuk");
    setMoveReason(p.category === "Produk Jadi" ? "rusak" : "terpakai");
    setMoveQty("");
    setMoveNote("");
    setFormError("");
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

    const hpp = calcProductHpp(sellingProduct, recipes);
    if (hpp <= 0) {
      const ok = confirm("HPP belum kehitung — pastikan resep di Produksi sudah dibuat (nama sama persis).\n\nLanjut jual tanpa catat HPP?");
      if (!ok) return;
    }

    setSellLoading(true);
    setFormError("");
    const totalJual = qty * harga;
    const totalHpp = qty * hpp;
    const laba = totalJual - totalHpp;
    const newStock = Math.max(0, sellingProduct.stock - qty);

    const prevStock = sellingProduct.stock;
    const { data: stockRow, error: stockErr } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", sellingProduct.id)
      .eq("stock", prevStock)
      .select("id")
      .maybeSingle();
    if (stockErr || !stockRow) {
      setFormError(stockErr?.message || "Stok berubah — muat ulang lalu coba lagi");
      setSellLoading(false);
      return;
    }

    const restoreStock = async () => {
      await supabase.from("products").update({ stock: prevStock }).eq("id", sellingProduct.id);
    };

    const { error: moveErr } = await supabase.from("stock_movements").insert({
      user_id: userId, product_id: sellingProduct.id, type: "keluar", reason: "terjual",
      quantity: qty, note: "Penjualan " + sellingProduct.name, profit_loss: laba, movement_date: today,
    });
    if (moveErr) {
      await restoreStock();
      setFormError("Gagal catat stok: " + moveErr.message);
      setSellLoading(false);
      return;
    }

    const { error: incErr } = await supabase.from("transactions").insert({
      user_id: userId, business_id: businessId,
      type: "pemasukan", scope: "bisnis", category: "Penjualan",
      description: "Jual " + sellingProduct.name + " x" + qty,
      amount: totalJual, transaction_date: today,
    });
    if (incErr) {
      await restoreStock();
      setFormError("Gagal catat penjualan: " + incErr.message);
      setSellLoading(false);
      return;
    }

    if (totalHpp > 0) {
      const { error: hppErr } = await supabase.from("transactions").insert({
        user_id: userId, business_id: businessId,
        type: "pengeluaran", scope: "bisnis", category: "HPP",
        description: "HPP " + sellingProduct.name + " x" + qty,
        amount: totalHpp, transaction_date: today,
      });
      if (hppErr) {
        setFormError("Penjualan tersimpan tapi HPP gagal: " + hppErr.message);
        setSellLoading(false);
        return;
      }
    }

    setSellLoading(false);
    setSellingProduct(null);
    setSellQty("");
    setSellPrice("");
    setSellSuccess({ nama: sellingProduct.name, total: totalJual, laba });
    router.refresh();
  };

  const startEdit = (p: Product) => {
    setEditProduct(p); setFNama(p.name); setFKategori(p.category || "Bahan Baku"); setFStok(p.stock.toString());
    setFSatuan("pcs"); setFHargaBeli(p.cost?.toString() || ""); setFHargaJual(p.price?.toString() || "");
    setFMinStok(p.min_stock.toString()); setFSku(p.sku || ""); setShowForm(p.category || "Bahan Baku");
  };

  const nilaiStok = stockValue(products, recipes);
  const produkJadiCount = products.filter(p => p.category === "Produk Jadi").length;
  const kritisCount = products.filter(p => p.stock <= p.min_stock).length;
  const produkJadi = products.filter(p => p.category === "Produk Jadi");
  const tanpaResep = produkJadi.filter(p => !findRecipeForProduct(p.name, recipes)).length;
  const tanpaHarga = produkJadi.filter(p => !p.price || p.price <= 0).length;
  const rugiCount = produkJadi.filter(p => {
    const hpp = calcProductHpp(p, recipes);
    return p.price && hpp > 0 && hpp > p.price;
  }).length;

  return (
    <div className="pb-24 md:pb-6">
      <HomeIndustryHubNav />

      <p className="mb-4 rounded-xl border border-white/[0.06] px-3 py-2 text-[11px] leading-relaxed text-[#5A5B7A]" style={{ background: "#0D0D1A" }}>
        <span className="text-[#2DD4BF] font-medium">Alur:</span> Isi stok bahan → buat resep di Produksi → catat produksi → jual produk jadi di sini (tombol <strong className="text-[#F0EFF8]">Jual</strong>).
      </p>

      <HomeIndustryStockAlerts products={products} />

      {(tanpaResep > 0 || rugiCount > 0 || tanpaHarga > 0) && (
        <div className="mb-5 space-y-2">
          {tanpaResep > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-[#F59E0B]/25 bg-[#F59E0B]/5 px-3 py-2.5">
              <AlertTriangle size={14} className="text-[#F59E0B] mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-[#F59E0B]">{tanpaResep} produk jadi belum punya resep — <Link href="/dashboard/produksi" className="underline text-[#2DD4BF]">buat di Produksi</Link> (nama harus sama persis).</p>
            </div>
          )}
          {tanpaHarga > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-300">{tanpaHarga} produk jadi belum ada harga jual — edit produk & isi harga jual.</p>
            </div>
          )}
          {rugiCount > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-[#EC4899]/25 bg-[#EC4899]/5 px-3 py-2.5">
              <AlertTriangle size={14} className="text-[#EC4899] mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-[#EC4899]">{rugiCount} produk dijual rugi (HPP &gt; harga jual) — naikkan harga atau kurangi bahan.</p>
            </div>
          )}
        </div>
      )}

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

      <HomeIndustryRecentSales sales={todaySales} today={today} />

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0F0F1A]/90 backdrop-blur-sm">
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
              {items.length === 0 && !isShowing ? (
                kat === "Produk Jadi" ? (
                  <FnbEmptyState
                    icon={ShoppingBag}
                    title="Belum ada produk jadi"
                    subtitle="Catat produksi di modul Produksi dulu — produk otomatis masuk stok di sini."
                    actionLabel="Ke Produksi"
                    actionHref="/dashboard/produksi"
                  />
                ) : (
                  <FnbEmptyState
                    icon={Plus}
                    title={"Belum ada " + kat.toLowerCase()}
                    subtitle="Tambah bahan biar bisa dipakai di resep produksi."
                    actionLabel={"Tambah " + kat.split(" ")[0].toLowerCase()}
                    onAction={() => { resetForm(); setFKategori(kat); setShowForm(kat); }}
                  />
                )
              ) : items.map(p => {
                  const color = KATEGORI_COLOR[p.category || ""] || "#8B8AA0";
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
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold" style={{ background: color + "18", color }}>{p.name.slice(0, 1).toUpperCase()}</div>
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
                                  <p className="text-[10px] text-[#F59E0B] mt-2 text-center">
                                    Buat resep di{" "}
                                    <Link href="/dashboard/produksi" className="underline text-[#2DD4BF]">Produksi</Link>
                                    {" "}(nama harus sama)
                                  </p>
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
                              <button onClick={() => openMove(p)} className="text-[#8B8AA0] hover:text-[#2DD4BF] p-1"><ArrowLeftRight size={14} /></button>
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
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold" style={{ background: color + "18", color }}>{p.name.slice(0, 1).toUpperCase()}</div>
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
                        <button onClick={() => openMove(p)} className="text-[#8B8AA0] hover:text-[#2DD4BF] p-1"><ArrowLeftRight size={14} /></button>
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => setMovingProduct(null)}>
          <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">{"Stok — " + movingProduct.name}</h3>
              <button onClick={() => setMovingProduct(null)} className="text-[#8B8AA0]">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={() => setMoveType("masuk")} className={"py-2 rounded-lg text-sm font-medium border " + (moveType === "masuk" ? "bg-[#2DD4BF]/15 border-[#2DD4BF]/40 text-[#2DD4BF]" : "border-white/10 text-[#8B8AA0]")}>Masuk</button>
              <button onClick={() => { setMoveType("keluar"); if (movingProduct.category === "Produk Jadi" && moveReason === "terjual") setMoveReason("rusak"); }} className={"py-2 rounded-lg text-sm font-medium border " + (moveType === "keluar" ? "bg-[#EC4899]/15 border-[#EC4899]/40 text-[#EC4899]" : "border-white/10 text-[#8B8AA0]")}>Keluar</button>
            </div>
            {moveType === "keluar" && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(movingProduct.category === "Produk Jadi"
                  ? [{ value: "rusak", label: "Cacat" }, { value: "lainnya", label: "Lainnya" }]
                  : [{ value: "terpakai", label: "Terpakai" }, { value: "rusak", label: "Rusak" }, { value: "lainnya", label: "Lainnya" }]
                ).map(o => <button key={o.value} onClick={() => setMoveReason(o.value)} className={"py-2 rounded-lg text-xs border " + (moveReason === o.value ? "border-[#EC4899]/40 bg-[#EC4899]/10 text-[#EC4899]" : "border-white/10 text-[#8B8AA0]")}>{o.label}</button>)}
              </div>
            )}
            {movingProduct.category === "Produk Jadi" && moveType === "keluar" && (
              <p className="text-[10px] text-[#F59E0B] mb-3 rounded-lg border border-[#F59E0B]/20 bg-[#F59E0B]/5 px-3 py-2">
                Mau jual? Tutup modal ini → pakai tombol <strong>Jual</strong> biar profit & HPP kehitung otomatis.
              </p>
            )}
            <input className={inputCls + " mb-2"} type="number" placeholder="Jumlah" value={moveQty} onChange={e => setMoveQty(e.target.value)} />
            <div className="mb-2"><label className="text-[10px] text-[#8B8AA0] mb-1 block">Tanggal</label><input className={inputCls} type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} style={{ colorScheme: "dark" }} /></div>
            <input className={inputCls + " mb-3"} placeholder="Catatan (opsional)" value={moveNote} onChange={e => setMoveNote(e.target.value)} />
            <p className="text-[10px] text-[#5A5B6A] mb-3">Otomatis tercatat di Keuangan Bisnis</p>
            <button onClick={handleMove} disabled={moveLoading} className="w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50" style={BTN_GRAD}>{moveLoading ? "Menyimpan..." : "Simpan"}</button>
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
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={() => setSellingProduct(null)}>
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
              {formError && <p className="text-xs text-[#EC4899] mb-2">{formError}</p>}
              <button
                onClick={handleJual}
                disabled={sellLoading || !sellQty || !sellPrice}
                className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={BTN_GRAD}
              >
                {sellLoading ? "Menyimpan..." : "Simpan Penjualan"}
              </button>
            </div>
          </div>
        );
      })()}

      {sellSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#070711]/95 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#2DD4BF]/25 p-7 text-center" style={{ background: "#0D0D1A" }}>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-[#2DD4BF]/30 bg-[#2DD4BF]/10">
              <Check size={24} className="text-[#2DD4BF]" />
            </div>
            <p className="mb-1 text-base font-semibold text-[#2DD4BF]">Penjualan berhasil!</p>
            <p className="mb-4 text-xs text-[#5A5B7A]">{sellSuccess.nama} · tercatat di Keuangan Bisnis</p>
            <div className="space-y-1.5 text-xs border-t border-white/[0.06] pt-3 mb-5">
              <div className="flex justify-between"><span className="text-[#5A5B7A]">Total jual</span><span className="font-mono text-[#F0EFF8]">{fmtRp(sellSuccess.total)}</span></div>
              <div className="flex justify-between"><span className="text-[#5A5B7A]">Laba</span><span className="font-mono text-[#2DD4BF]">{fmtRp(sellSuccess.laba)}</span></div>
            </div>
            <button type="button" onClick={() => setSellSuccess(null)} className="w-full rounded-xl py-3 text-sm font-semibold mb-2" style={BTN_GRAD}>
              + Jual lagi
            </button>
            <Link href="/dashboard/keuangan-bisnis" className="block w-full rounded-xl border border-white/10 py-2.5 text-xs text-[#8B8AA0] hover:text-[#2DD4BF] transition-colors">
              Lihat di Keuangan Bisnis →
            </Link>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setQuickOpen(true)}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 z-[70] flex h-14 w-14 items-center justify-center rounded-full shadow-lg active:scale-95 md:hidden"
        style={{ ...BTN_GRAD, boxShadow: "0 8px 32px rgba(45,212,191,0.25)" }}
        aria-label="Tambah bahan"
      >
        <Plus size={24} />
      </button>

      {quickOpen && (
        <div className="fixed inset-0 z-[80] bg-black/60 md:hidden" onClick={() => setQuickOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl border border-white/10 p-5 pb-8" style={{ background: "#0D0D1A" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-[#F0EFF8]">Tambah cepat</p>
              <button type="button" onClick={() => setQuickOpen(false)} className="text-[#8B8AA0]"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {KATEGORI.filter(k => k !== "Produk Jadi").map(kat => {
                const c = KATEGORI_COLOR[kat] || "#8B8AA0";
                return (
                  <button
                    key={kat}
                    type="button"
                    onClick={() => { resetForm(); setFKategori(kat); setShowForm(kat); setActiveTab(kat); setQuickOpen(false); }}
                    className="rounded-xl border px-3 py-3 text-left text-xs font-medium transition-colors hover:border-white/20"
                    style={{ borderColor: c + "40", background: c + "10", color: c }}
                  >
                    {kat}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[10px] text-[#5A5B7A] text-center">Produk jadi otomatis dari modul Produksi</p>
          </div>
        </div>
      )}
    </div>
  );
}
