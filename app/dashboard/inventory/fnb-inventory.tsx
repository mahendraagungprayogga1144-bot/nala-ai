"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Search, Trash2, ArrowLeftRight, Edit2, X, Package } from "lucide-react";
import FnbHubNav from "../fnb/components/fnb-hub-nav";
import FnbWorkflowSteps from "../fnb/components/fnb-workflow-steps";
import FnbKpiRow from "../fnb/components/fnb-kpi-row";
import FnbStockAlerts from "../fnb/components/fnb-stock-alerts";
import FnbEmptyState from "../fnb/components/fnb-empty-state";
import { fmtRp } from "../fnb/lib/calc";

type Product = { id: string; name: string; sku: string | null; stock: number; min_stock: number; price: number | null; cost: number | null; category: string | null; photo_url: string | null; unit?: string | null };

const KATEGORI = ["Bahan Baku", "Bumbu", "Minuman", "Kemasan", "Produk Siap Jual"];
const SATUAN_OPTIONS = ["kg", "gram", "liter", "ml", "pcs", "botol", "sachet", "bungkus", "porsi", "lusin", "unit"];
const KATEGORI_COLOR: Record<string, string> = { "Bahan Baku": "#2DD4BF", "Bumbu": "#F59E0B", "Minuman": "#38BDF8", "Kemasan": "#8B5CF6", "Produk Siap Jual": "#EC4899" };
const KATEGORI_ICON: Record<string, string> = { "Bahan Baku": "ti-meat", "Bumbu": "ti-leaf", "Minuman": "ti-glass", "Kemasan": "ti-package", "Produk Siap Jual": "ti-bowl-chopsticks" };
const BTN_GRAD = { background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" } as const;
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

function AddForm({ kat, editProduct, fNama, setFNama, fStok, setFStok, fSatuan, setFSatuan, fHargaBeli, setFHargaBeli, fHargaJual, setFHargaJual, fMinStok, setFMinStok, fSku, setFSku, formLoading, onSave, onCancel }: FormProps) {
  const color = KATEGORI_COLOR[kat] || "#8B8AA0";
  const isSiapJual = kat === "Produk Siap Jual";
  const laba = fHargaJual && fHargaBeli ? Number(fHargaJual) - Number(fHargaBeli) : null;
  const margin = laba && Number(fHargaBeli) > 0 ? Math.round(laba / Number(fHargaBeli) * 100) : null;
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
          <input className={inputCls} type="number" placeholder={isSiapJual ? "HPP/satuan (Rp)" : "Harga beli/satuan (Rp)"} value={fHargaBeli} onChange={e => setFHargaBeli(e.target.value)} />
          <input className={inputCls} type="number" placeholder="Harga jual/satuan (Rp)" value={fHargaJual} onChange={e => setFHargaJual(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} type="number" placeholder="Min. stok" value={fMinStok} onChange={e => setFMinStok(e.target.value)} />
          <input className={inputCls} placeholder="SKU (opsional)" value={fSku} onChange={e => setFSku(e.target.value)} />
        </div>
        {isSiapJual && laba !== null && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: laba >= 0 ? "#2DD4BF15" : "#EC489915", border: "1px solid " + (laba >= 0 ? "#2DD4BF" : "#EC4899") + "30" }}>
            <div className="flex justify-between mb-1"><span style={{ color: "#8B8AA0" }}>HPP</span><span>{"Rp" + Number(fHargaBeli).toLocaleString("id-ID")}</span></div>
            <div className="flex justify-between mb-1"><span style={{ color: "#8B8AA0" }}>Harga jual</span><span>{"Rp" + Number(fHargaJual).toLocaleString("id-ID")}</span></div>
            <div className="flex justify-between font-medium" style={{ color: laba >= 0 ? "#2DD4BF" : "#EC4899" }}>
              <span>{laba >= 0 ? "Laba" : "RUGI"}/unit</span>
              <span>{"Rp" + Math.abs(laba).toLocaleString("id-ID") + " (" + Math.abs(margin || 0) + "%)"}</span>
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

export default function FnBInventory({ products, userId, businessId }: { products: Product[]; userId: string; businessId?: string }) {
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
  const [moveDate, setMoveDate] = useState(new Date().toISOString().split("T")[0]);
  const [moveNote, setMoveNote] = useState("");
  const [moveLoading, setMoveLoading] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const resetForm = () => { setFNama(""); setFStok(""); setFSatuan("kg"); setFHargaBeli(""); setFHargaJual(""); setFMinStok("5"); setFSku(""); setEditProduct(null); };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && (activeTab === "Semua" || p.category === activeTab));
  const byKategori = (kat: string) => filtered.filter(p => p.category === kat);
  const lainnya = filtered.filter(p => !KATEGORI.includes(p.category || ""));

  const handleSave = async () => {
    if (!fNama || !fStok) return;
    setFormLoading(true);
    const payload = {
      user_id: userId, business_id: businessId, name: fNama, category: fKategori,
      stock: Number(fStok), min_stock: Number(fMinStok),
      cost: fHargaBeli ? Number(fHargaBeli) : null,
      price: fHargaJual ? Number(fHargaJual) : null,
      sku: fSku || null, unit: fSatuan || "kg",
    };
    if (editProduct) { await supabase.from("products").update(payload).eq("id", editProduct.id); }
    else { await supabase.from("products").insert(payload); }
    setFormLoading(false); resetForm(); setShowForm(null); router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus item ini?")) return;
    await supabase.from("stock_movements").delete().eq("product_id", id);
    await supabase.from("menu_recipes").delete().eq("product_id", id);
    await supabase.from("products").delete().eq("id", id);
    router.refresh();
  };

  const handleMove = async () => {
    if (!movingProduct || !moveQty) return;
    setMoveLoading(true);
    const qty = Number(moveQty);
    const newStock = moveType === "masuk" ? movingProduct.stock + qty : Math.max(0, movingProduct.stock - qty);
    const isSell = moveReason === "terjual";
    const profitLoss = moveType === "keluar" && isSell && movingProduct.price && movingProduct.cost ? (movingProduct.price - movingProduct.cost) * qty : 0;
    await supabase.from("products").update({ stock: newStock }).eq("id", movingProduct.id);
    await supabase.from("stock_movements").insert({ user_id: userId, product_id: movingProduct.id, type: moveType, reason: moveType === "keluar" ? moveReason : null, quantity: qty, note: moveNote || null, profit_loss: profitLoss, movement_date: moveDate });
    if (moveType === "keluar" && isSell && movingProduct.price) {
      await supabase.from("transactions").insert({ user_id: userId, business_id: businessId, type: "pemasukan", scope: "bisnis", category: "Penjualan", description: "Jual " + movingProduct.name + " (" + qty + ")", amount: movingProduct.price * qty, transaction_date: moveDate });
    } else if (moveType === "masuk" && movingProduct.cost) {
      await supabase.from("transactions").insert({ user_id: userId, business_id: businessId, type: "pengeluaran", scope: "bisnis", category: "Pembelian Bahan", description: "Beli " + movingProduct.name + " (" + qty + ")", amount: movingProduct.cost * qty, transaction_date: moveDate });
    }
    setMoveLoading(false); setMovingProduct(null); setMoveQty(""); setMoveNote(""); router.refresh();
  };

  const startEdit = (p: Product) => {
    setEditProduct(p); setFNama(p.name); setFKategori(p.category || "Bahan Baku"); setFStok(p.stock.toString());
    setFSatuan(p.unit || "kg"); setFHargaBeli(p.cost?.toString() || ""); setFHargaJual(p.price?.toString() || "");
    setFMinStok(p.min_stock.toString()); setFSku(p.sku || ""); setShowForm(p.category || "Bahan Baku");
  };

  const nilaiStok = products.reduce((s, p) => s + (p.cost || 0) * p.stock, 0);
  const hampirHabis = products.filter(p => p.stock > 0 && p.stock <= p.min_stock).length;
  const habis = products.filter(p => p.stock <= 0).length;

  return (
    <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <FnbHubNav />
      <FnbWorkflowSteps activePath="/dashboard/inventory" />

      <FnbStockAlerts products={products} />
      <FnbKpiRow items={[
        { label: "Total bahan", value: String(products.length), color: "#38BDF8" },
        { label: "Hampir habis", value: String(hampirHabis), color: "#F59E0B" },
        { label: "Nilai stok", value: fmtRp(nilaiStok), color: "#2DD4BF" },
        { label: "Bahan habis", value: String(habis), color: habis > 0 ? "#EC4899" : "#2DD4BF" },
      ]} />

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0F0F1A]/90 backdrop-blur-sm">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0F0F1A]/95 backdrop-blur-md md:static md:bg-transparent md:backdrop-blur-none">
          <div className="flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8AA0]" />
              <input type="text" placeholder="Cari bahan..." value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0A0A12] py-2.5 pl-9 pr-3 text-sm text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:border-[#2DD4BF]/50 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-3 py-2 scrollbar-none md:px-4 md:py-2.5">
            {["Semua", ...KATEGORI].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={"text-[11px] px-3.5 py-1.5 rounded-full border whitespace-nowrap transition-colors " + (activeTab === tab ? "bg-[#2DD4BF]/15 border-[#2DD4BF]/40 text-[#2DD4BF] font-medium" : "border-white/10 text-[#8B8AA0]")}>{tab}</button>
            ))}
          </div>
        </div>

        {(activeTab === "Semua" ? KATEGORI : [activeTab]).map(kat => {
          const items = byKategori(kat);
          const color = KATEGORI_COLOR[kat] || "#8B8AA0";
          const icon = KATEGORI_ICON[kat] || "ti-package";
          const isShowing = showForm === kat;
          return (
            <div key={kat} className="mb-2">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]" style={{ background: color + "08" }}>
                <span className="text-[11px] font-semibold tracking-wide uppercase flex items-center gap-2" style={{ color }}>
                  <i className={"ti " + icon} aria-hidden="true"></i>
                  {kat + " (" + items.length + ")"}
                </span>
                <button onClick={() => { resetForm(); setFKategori(kat); setShowForm(isShowing && !editProduct ? null : kat); }} className="text-[10px] flex items-center gap-1 px-2.5 py-1 rounded-lg border" style={{ color, borderColor: color + "40", background: color + "10" }}>
                  <Plus size={10} /> Tambah
                </button>
              </div>
              {isShowing && (
                <AddForm kat={kat} editProduct={editProduct}
                  fNama={fNama} setFNama={setFNama} fStok={fStok} setFStok={setFStok}
                  fSatuan={fSatuan} setFSatuan={setFSatuan} fHargaBeli={fHargaBeli} setFHargaBeli={setFHargaBeli}
                  fHargaJual={fHargaJual} setFHargaJual={setFHargaJual} fMinStok={fMinStok} setFMinStok={setFMinStok}
                  fSku={fSku} setFSku={setFSku} formLoading={formLoading}
                  onSave={handleSave} onCancel={() => { resetForm(); setShowForm(null); }} />
              )}
              {items.length === 0 && !isShowing ? (
                <FnbEmptyState
                  icon={Package}
                  title={"Belum ada " + kat.toLowerCase()}
                  subtitle="Tambah bahan biar bisa dipakai di resep menu."
                  actionLabel={"Tambah " + kat.split(" ")[0].toLowerCase()}
                  onAction={() => { resetForm(); setFKategori(kat); setShowForm(kat); }}
                />
              ) : items.map(p => {
                  const pIcon = KATEGORI_ICON[p.category || ""] || "ti-package";
                  const pColor = KATEGORI_COLOR[p.category || ""] || "#8B8AA0";
                  const isKritis = p.stock <= p.min_stock;
                  const isHabis = p.stock <= 0;
                  const isSiapJual = p.category === "Produk Siap Jual";
                  const laba = isSiapJual && p.price && p.cost ? p.price - p.cost : null;
                  const isRugi = laba !== null && laba < 0;
                  const stockColor = isHabis ? "text-[#EC4899]" : isKritis ? "text-[#F59E0B]" : "text-[#F2F1F8]";
                  const detailLine = [
                    p.unit ? `${p.stock} ${p.unit}` : null,
                    p.cost ? `${isSiapJual ? "HPP" : "Beli"} ${fmtRp(Number(p.cost))}` : null,
                    p.price ? `Jual ${fmtRp(Number(p.price))}` : null,
                  ].filter(Boolean).join(" · ");
                  return (
                    <div key={p.id}>
                      {/* Mobile — card layout */}
                      <div className="border-b border-white/[0.04] px-3 py-3 last:border-0 md:hidden">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: pColor + "18", color: pColor }}>
                            <i className={"ti " + pIcon} style={{ fontSize: "18px" }} aria-hidden="true"></i>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[#F0EFF8]">{p.name}</p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {isHabis && <span className="rounded-md bg-[#EC4899]/15 px-1.5 py-0.5 text-[9px] text-[#EC4899]">Habis</span>}
                                  {!isHabis && isKritis && <span className="rounded-md bg-[#F59E0B]/15 px-1.5 py-0.5 text-[9px] text-[#F59E0B]">Hampir habis</span>}
                                  {isRugi && <span className="rounded-md bg-[#EC4899]/15 px-1.5 py-0.5 text-[9px] text-[#EC4899]">Rugi</span>}
                                </div>
                              </div>
                              <p className={`font-mono text-lg font-bold tabular-nums ${stockColor}`}>{p.stock}</p>
                            </div>
                            {detailLine && <p className="mt-1.5 truncate text-[11px] text-[#8B8AA0]">{detailLine}</p>}
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => { setMovingProduct(p); setMoveType("masuk"); setMoveReason("terpakai"); }}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 py-2.5 text-xs font-medium text-[#2DD4BF] active:scale-[0.98]"
                              >
                                <ArrowLeftRight size={14} /> Stok
                              </button>
                              <button type="button" onClick={() => startEdit(p)} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[#8B8AA0] active:scale-[0.98]"><Edit2 size={16} /></button>
                              <button type="button" onClick={() => handleDelete(p.id)} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[#8B8AA0] active:scale-[0.98]"><Trash2 size={16} /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Desktop — compact row */}
                      <div className="hidden items-center justify-between border-b border-white/[0.04] px-4 py-3 last:border-0 md:flex">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: pColor + "18", color: pColor }}>
                            <i className={"ti " + pIcon} style={{ fontSize: "16px" }} aria-hidden="true"></i>
                          </div>
                          <div>
                            <div className="mb-0.5 flex items-center gap-2">
                              <p className="text-sm font-medium">{p.name}</p>
                              {p.sku && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[#8B8AA0]">{p.sku}</span>}
                              {isHabis && <span className="rounded bg-[#EC4899]/15 px-1.5 py-0.5 text-[10px] text-[#EC4899]">Habis</span>}
                              {!isHabis && isKritis && <span className="rounded bg-[#F59E0B]/15 px-1.5 py-0.5 text-[10px] text-[#F59E0B]">Hampir habis</span>}
                              {isRugi && <span className="rounded bg-[#EC4899]/15 px-1.5 py-0.5 text-[10px] text-[#EC4899]">Rugi</span>}
                            </div>
                            <p className="text-[11px] text-[#8B8AA0]">
                              {p.unit && <span>{p.stock} {p.unit} · </span>}
                              {p.cost ? (isSiapJual ? "HPP" : "Beli") + " " + fmtRp(Number(p.cost)) : ""}
                              {p.price ? " · Jual " + fmtRp(Number(p.price)) : ""}
                              {laba !== null && <span style={{ color: laba >= 0 ? "#2DD4BF" : "#EC4899" }}>{" · " + (laba >= 0 ? "Laba" : "RUGI") + " Rp" + Math.abs(laba).toLocaleString("id-ID")}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className={`font-mono text-sm font-semibold ${stockColor}`}>{p.stock}</p>
                          <button onClick={() => { setMovingProduct(p); setMoveType("masuk"); setMoveReason("terpakai"); }} className="p-1 text-[#8B8AA0] hover:text-[#2DD4BF]"><ArrowLeftRight size={14} /></button>
                          <button onClick={() => startEdit(p)} className="p-1 text-[#8B8AA0] hover:text-[#38BDF8]"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(p.id)} className="p-1 text-[#8B8AA0] hover:text-[#EC4899]"><Trash2 size={14} /></button>
                        </div>
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
            <p className="text-sm">{p.name}</p>
            <p className="text-sm font-mono">{p.stock}</p>
          </div>
        ))}
      </div>

      {movingProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setMovingProduct(null)}>
          <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">{"Stok — " + movingProduct.name}</h3>
              <button onClick={() => setMovingProduct(null)} className="text-[#8B8AA0]">x</button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={() => setMoveType("masuk")} className={"py-2 rounded-lg text-sm font-medium border " + (moveType === "masuk" ? "bg-[#2DD4BF]/15 border-[#2DD4BF]/40 text-[#2DD4BF]" : "border-white/10 text-[#8B8AA0]")}>Masuk</button>
              <button onClick={() => setMoveType("keluar")} className={"py-2 rounded-lg text-sm font-medium border " + (moveType === "keluar" ? "bg-[#EC4899]/15 border-[#EC4899]/40 text-[#EC4899]" : "border-white/10 text-[#8B8AA0]")}>Keluar</button>
            </div>
            {moveType === "keluar" && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[{ value: "terpakai", label: "Terpakai" }, { value: "terjual", label: "Terjual" }, { value: "rusak", label: "Rusak/Exp" }].map(o => (
                  <button key={o.value} onClick={() => setMoveReason(o.value)} className={"py-2 rounded-lg text-xs border " + (moveReason === o.value ? "border-[#EC4899]/40 bg-[#EC4899]/10 text-[#EC4899]" : "border-white/10 text-[#8B8AA0]")}>{o.label}</button>
                ))}
              </div>
            )}
            <input className={inputCls + " mb-2"} type="number" placeholder="Jumlah" value={moveQty} onChange={e => setMoveQty(e.target.value)} />
            <div className="mb-2"><label className="text-[10px] text-[#8B8AA0] mb-1 block">Tanggal</label><input className={inputCls} type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} style={{ colorScheme: "dark" }} /></div>
            <input className={inputCls + " mb-3"} placeholder="Catatan (opsional)" value={moveNote} onChange={e => setMoveNote(e.target.value)} />
            <p className="text-[10px] text-[#5A5B6A] mb-3">Otomatis tercatat di Keuangan Bisnis</p>
            <button onClick={handleMove} disabled={moveLoading} className="w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50" style={BTN_GRAD}>
              {moveLoading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}

      {/* Mobile FAB — tambah bahan cepat */}
      <button
        type="button"
        onClick={() => { resetForm(); setFKategori("Bahan Baku"); setQuickOpen(true); }}
        className="md:hidden fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg active:scale-95"
        style={{ ...BTN_GRAD, boxShadow: "0 8px 32px rgba(45,212,191,0.25)" }}
        aria-label="Tambah bahan"
      >
        <Plus size={24} />
      </button>

      {quickOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 md:items-center md:justify-center" onClick={() => setQuickOpen(false)}>
          <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0F0F1A] p-5 md:max-w-md md:rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Tambah Bahan — 3 langkah</h3>
              <button type="button" onClick={() => setQuickOpen(false)} className="text-[#8B8AA0]"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-3">
              <input className={inputCls} placeholder="Nama bahan" value={fNama} onChange={e => setFNama(e.target.value)} />
              <select className={inputCls} value={fKategori} onChange={e => setFKategori(e.target.value)}>
                {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} type="number" placeholder="Stok" value={fStok} onChange={e => setFStok(e.target.value)} />
                <select className={inputCls} value={fSatuan} onChange={e => setFSatuan(e.target.value)}>
                  {SATUAN_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <input className={inputCls} type="number" placeholder="Harga beli (Rp)" value={fHargaBeli} onChange={e => setFHargaBeli(e.target.value)} />
              <button
                type="button"
                disabled={formLoading || !fNama || !fStok}
                onClick={async () => { await handleSave(); setQuickOpen(false); }}
                className="mt-2 w-full rounded-xl py-3.5 text-sm font-bold disabled:opacity-40"
                style={BTN_GRAD}
              >
                {formLoading ? "Menyimpan..." : "Simpan Bahan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
