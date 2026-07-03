"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Search, ShoppingBag, AlertTriangle, X, Check } from "lucide-react";
import { calcAgriHppPerUnit, recordAgriPenjualan } from "../pertanian/lib/agri-sync";
import AgriHubNav from "../pertanian/agri-hub-nav";
import FnbEmptyState from "../fnb/components/fnb-empty-state";
import { fmtRp, isHarvestCategory, isSaprotanCategory, cardCls } from "../pertanian/lib/constants";

type Product = { id: string; name: string; stock: number; min_stock: number; price: number | null; cost: number | null; category: string | null; photo_url?: string | null };
type HarvestMeta = { product_id: string; satuan?: string | null };
type Sale = { description: string | null; amount: number };

const BTN_GRAD = { background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" } as const;
const inputCls = "w-full px-3 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50 text-sm";

export default function AgricultureInventory({
  products, harvestMeta, userId, businessId,
  totalBiaya, profitHariIni, penjualanHariIni, hppHariIni, todaySales, today,
}: {
  products: Product[];
  harvestMeta: HarvestMeta[];
  userId: string;
  businessId?: string;
  totalBiaya: number;
  profitHariIni: number;
  penjualanHariIni: number;
  hppHariIni: number;
  todaySales: Sale[];
  today: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  const [sellQty, setSellQty] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellLoading, setSellLoading] = useState(false);
  const [sellSuccess, setSellSuccess] = useState<{ nama: string; total: number; laba: number } | null>(null);
  const [formError, setFormError] = useState("");

  const harvest = products.filter(p => isHarvestCategory(p.category));
  const saprotan = products.filter(p => isSaprotanCategory(p.category));
  const totalPanenStock = harvest.reduce((s, p) => s + p.stock, 0);
  const hppPerUnit = calcAgriHppPerUnit(totalBiaya, totalPanenStock);
  const kritisSaprotan = saprotan.filter(p => p.stock <= p.min_stock).length;

  const filteredHarvest = harvest.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const getSatuan = (id: string) => harvestMeta.find(m => m.product_id === id)?.satuan || "kg";

  const openSell = (p: Product) => {
    setSellingProduct(p);
    setSellQty("");
    setSellPrice(p.price ? String(p.price) : "");
    setFormError("");
  };

  const handleJual = async () => {
    if (!sellingProduct || !sellQty || !sellPrice || !businessId) return;
    const qty = Number(sellQty);
    const harga = Number(sellPrice);
    if (qty <= 0 || harga <= 0) return;
    if (qty > sellingProduct.stock) { setFormError("Stok tidak cukup! Tersedia: " + sellingProduct.stock); return; }

    setSellLoading(true);
    setFormError("");
    try {
      const newStock = Math.max(0, sellingProduct.stock - qty);
      const { error: stockErr } = await supabase.from("products").update({ stock: newStock }).eq("id", sellingProduct.id);
      if (stockErr) throw new Error(stockErr.message);

      const { totalJual, laba } = await recordAgriPenjualan(supabase, {
        userId, businessId, productName: sellingProduct.name, qty, harga,
        hppPerUnit, tanggal: today,
      });

      await supabase.from("stock_movements").insert({
        user_id: userId, product_id: sellingProduct.id, type: "keluar", reason: "terjual",
        quantity: qty, note: "Penjualan " + sellingProduct.name, profit_loss: laba, movement_date: today,
      });

      setSellingProduct(null);
      setSellSuccess({ nama: sellingProduct.name, total: totalJual, laba });
      router.refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Gagal menyimpan");
    }
    setSellLoading(false);
  };

  return (
    <div className="pb-24 md:pb-6">
      <AgriHubNav />

      <p className="mb-4 rounded-xl border border-white/[0.06] px-3 py-2 text-[11px] leading-relaxed text-[#5A5B7A]" style={{ background: "#0D0D1A" }}>
        <span className="text-[#2DD4BF] font-medium">Alur:</span> Catat panen & biaya di Modul Pertanian → jual hasil panen di sini (tombol <strong className="text-[#F0EFF8]">Jual</strong>) → otomatis ke Keuangan.
      </p>

      {kritisSaprotan > 0 && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
          <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-amber-300">{kritisSaprotan} saprotan stok menipis — <Link href="/dashboard/pertanian" className="underline text-[#2DD4BF]">restock di Modul Pertanian</Link></p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className={`${cardCls} p-4`}><p className="text-xs text-[#8B8AA0] mb-1">Komoditas panen</p><p className="text-lg font-mono font-semibold text-[#2DD4BF]">{harvest.length}</p></div>
        <div className={`${cardCls} p-4`}><p className="text-xs text-[#8B8AA0] mb-1">Stok panen</p><p className="text-lg font-mono font-semibold text-[#38BDF8]">{totalPanenStock}</p></div>
        <div className={`${cardCls} p-4`}><p className="text-xs text-[#8B8AA0] mb-1">HPP/unit</p><p className="text-lg font-mono font-semibold text-[#8B5CF6]">{fmtRp(hppPerUnit)}</p></div>
        <div className={`${cardCls} p-4`}>
          <p className="text-xs text-[#8B8AA0] mb-1">Profit hari ini</p>
          <p className="text-lg font-mono font-semibold" style={{ color: profitHariIni >= 0 ? "#2DD4BF" : "#EC4899" }}>{fmtRp(profitHariIni)}</p>
          <p className="text-[10px] text-[#5A5B7A] mt-0.5">Jual {fmtRp(penjualanHariIni)} · HPP {fmtRp(hppHariIni)}</p>
        </div>
      </div>

      {todaySales.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-white/[0.08]" style={{ background: "#0D0D1A" }}>
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <p className="text-sm font-medium text-[#F0EFF8]">Penjualan hari ini</p>
            <Link href="/dashboard/keuangan-bisnis" className="text-[10px] text-[#2DD4BF] underline">Keuangan →</Link>
          </div>
          {todaySales.map((s, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] last:border-0">
              <p className="text-xs text-[#8B8AA0] truncate flex-1 mr-3">{s.description || "Penjualan"}</p>
              <span className="font-mono text-xs font-semibold text-[#2DD4BF]">{fmtRp(Number(s.amount))}</span>
            </div>
          ))}
          <p className="px-4 py-2 text-[10px] text-[#5A5B7A]">{today} · WIB</p>
        </div>
      )}

      <div className={`${cardCls} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8AA0]" />
            <input type="text" placeholder="Cari komoditas panen..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] text-sm placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" />
          </div>
          <Link href="/dashboard/pertanian" className="text-[10px] px-3 py-2 rounded-lg border border-[#2DD4BF]/30 text-[#2DD4BF] whitespace-nowrap">+ Catat Panen</Link>
        </div>

        {filteredHarvest.length === 0 ? (
          <FnbEmptyState
            icon={ShoppingBag}
            title="Belum ada hasil panen"
            subtitle="Catat panen di Modul Pertanian dulu — stok muncul di sini untuk dijual."
            actionLabel="Ke Modul Pertanian"
            actionHref="/dashboard/pertanian"
          />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filteredHarvest.map(p => {
              const isKritis = p.stock <= p.min_stock;
              const satuan = getSatuan(p.id);
              const margin = p.price && hppPerUnit > 0 ? Math.round(((p.price - hppPerUnit) / p.price) * 100) : null;
              const isRugi = p.price && hppPerUnit > 0 && hppPerUnit > p.price;
              return (
                <div key={p.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-medium">{p.name}</p>
                        <span className="text-[10px] text-[#8B8AA0] bg-white/5 px-1.5 py-0.5 rounded">{p.category}</span>
                        {isRugi && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EC4899]/15 text-[#EC4899]">Jual Rugi!</span>}
                        {isKritis && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F59E0B]/15 text-[#F59E0B]">Stok kritis</span>}
                      </div>
                      <div className="rounded-xl border border-[#2DD4BF]/20 px-3 py-2 mt-1" style={{ background: "rgba(45,212,191,0.06)" }}>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div><p className="text-[9px] text-[#5A5B7A]">HPP/{satuan}</p><p className="font-mono font-semibold text-[#2DD4BF]">{fmtRp(hppPerUnit)}</p></div>
                          <div><p className="text-[9px] text-[#5A5B7A]">Harga jual</p><p className="font-mono font-semibold text-[#F0EFF8]">{p.price ? fmtRp(p.price) : "—"}</p></div>
                          <div><p className="text-[9px] text-[#5A5B7A]">Margin</p><p className="font-mono font-semibold" style={{ color: margin !== null && margin >= 0 ? "#2DD4BF" : "#EC4899" }}>{margin !== null ? margin + "%" : "—"}</p></div>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#8B8AA0] mt-1.5">Stok: <span className="font-mono text-[#F0EFF8]">{p.stock} {satuan}</span></p>
                    </div>
                    <button
                      onClick={() => openSell(p)}
                      disabled={p.stock <= 0}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-40 flex-shrink-0"
                      style={BTN_GRAD}
                    >
                      <ShoppingBag size={12} /> Jual
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {sellingProduct && (() => {
        const qty = Number(sellQty) || 0;
        const harga = Number(sellPrice) || 0;
        const total = qty * harga;
        const totalHpp = qty * hppPerUnit;
        const laba = total - totalHpp;
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSellingProduct(null)}>
            <div className="rounded-2xl border border-white/10 p-5 w-full max-w-sm" style={{ background: "#0D0D1A" }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-sm">{sellingProduct.name}</h3>
                <button onClick={() => setSellingProduct(null)} className="text-[#8B8AA0]"><X size={18} /></button>
              </div>
              <p className="text-xs text-[#8B8AA0] mb-3">Stok: {sellingProduct.stock} · HPP/{getSatuan(sellingProduct.id)}: {fmtRp(hppPerUnit)}</p>
              <div className="flex flex-col gap-2 mb-3">
                <input className={inputCls} type="number" placeholder="Jumlah terjual" value={sellQty} onChange={e => setSellQty(e.target.value)} />
                <input className={inputCls} type="number" placeholder="Harga jual per unit" value={sellPrice} onChange={e => setSellPrice(e.target.value)} />
              </div>
              {qty > 0 && harga > 0 && (
                <div className="rounded-xl border border-white/[0.08] px-3 py-2 mb-3 text-xs space-y-1" style={{ background: "#0A0A12" }}>
                  <div className="flex justify-between"><span className="text-[#8B8AA0]">Total jual</span><span className="font-mono">{fmtRp(total)}</span></div>
                  <div className="flex justify-between"><span className="text-[#8B8AA0]">Laba</span><span className="font-mono text-[#2DD4BF]">{fmtRp(laba)}</span></div>
                </div>
              )}
              {formError && <p className="text-xs text-[#EC4899] mb-2">{formError}</p>}
              <button onClick={handleJual} disabled={sellLoading || !sellQty || !sellPrice} className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40" style={BTN_GRAD}>
                {sellLoading ? "Menyimpan..." : "Simpan Penjualan"}
              </button>
            </div>
          </div>
        );
      })()}

      {sellSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#070711]/95 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#2DD4BF]/25 p-7 text-center" style={{ background: "#0D0D1A" }}>
            <Check size={24} className="text-[#2DD4BF] mx-auto mb-3" />
            <p className="mb-1 text-base font-semibold text-[#2DD4BF]">Penjualan berhasil!</p>
            <p className="mb-4 text-xs text-[#5A5B7A]">{sellSuccess.nama} · Laba {fmtRp(sellSuccess.laba)}</p>
            <button type="button" onClick={() => setSellSuccess(null)} className="w-full rounded-xl py-3 text-sm font-semibold mb-2" style={BTN_GRAD}>+ Jual lagi</button>
            <Link href="/dashboard/keuangan-bisnis" className="block text-xs text-[#8B8AA0] hover:text-[#2DD4BF]">Keuangan Bisnis →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
