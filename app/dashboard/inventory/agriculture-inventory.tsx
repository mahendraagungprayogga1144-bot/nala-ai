"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Search, ShoppingBag, AlertTriangle, X, Check, ArrowDownToLine, ArrowUpFromLine, Sprout } from "lucide-react";
import { computeAgriTotalCost, calcAgriProductHpp, recordAgriPenjualan } from "../pertanian/lib/agri-sync";
import AgriHubNav from "../pertanian/agri-hub-nav";
import FnbEmptyState from "../fnb/components/fnb-empty-state";
import { fmtRp, isHarvestCategory, isSaprotanCategory, cardCls } from "../pertanian/lib/constants";
import { todayWib } from "@/lib/date";
import type { StockMovementRow } from "./lib/typed-stock-actions";
import { RecentMovementsStrip } from "./lib/inventory-ui-shared";

type Product = { id: string; name: string; stock: number; min_stock: number; price: number | null; cost: number | null; category: string | null; photo_url?: string | null };
type HarvestMeta = { product_id: string; satuan?: string | null };
type Sale = { description: string | null; amount: number };

const BTN_GRAD = { background: "linear-gradient(135deg, #84CC16, #2DD4BF)", color: "#070711" } as const;
const inputCls = "w-full px-3 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#84CC16]/50 text-sm";
const ACCENT = "#84CC16";

export default function AgricultureInventory({
  products, harvestMeta, userId, businessId,
  totalBiayaProduksi, totalBiayaSemprot,
  profitHariIni, penjualanHariIni, hppHariIni, todaySales, today,
  movements = [],
}: {
  products: Product[];
  harvestMeta: HarvestMeta[];
  userId: string;
  businessId?: string;
  totalBiayaProduksi: number;
  totalBiayaSemprot: number;
  profitHariIni: number;
  penjualanHariIni: number;
  hppHariIni: number;
  todaySales: Sale[];
  today: string;
  movements?: StockMovementRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<"panen" | "saprotan">("panen");
  const [search, setSearch] = useState("");
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  const [sellQty, setSellQty] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellLoading, setSellLoading] = useState(false);
  const [sellSuccess, setSellSuccess] = useState<{ nama: string; total: number; laba: number } | null>(null);
  const [formError, setFormError] = useState("");

  const [moveProduct, setMoveProduct] = useState<Product | null>(null);
  const [moveMode, setMoveMode] = useState<"masuk" | "keluar">("masuk");
  const [moveQty, setMoveQty] = useState("");
  const [moveReason, setMoveReason] = useState("rusak");
  const [moveNote, setMoveNote] = useState("");
  const [moveLoading, setMoveLoading] = useState(false);

  const harvest = products.filter((p) => isHarvestCategory(p.category));
  const saprotan = products.filter((p) => isSaprotanCategory(p.category));
  const { totalCost, saprotanCost, harvestStock, hppPerUnit } = computeAgriTotalCost(products, totalBiayaProduksi, totalBiayaSemprot);
  const kritisSaprotan = saprotan.filter((p) => p.stock <= p.min_stock).length;
  const hppBelumAda = hppPerUnit <= 0 && harvest.length > 0;

  const list = tab === "panen" ? harvest : saprotan;
  const filtered = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const getSatuan = (id: string) => harvestMeta.find((m) => m.product_id === id)?.satuan || "kg";

  const openSell = (p: Product) => {
    setSellingProduct(p);
    setSellQty("");
    setSellPrice(p.price ? String(p.price) : "");
    setFormError("");
  };

  const openMove = (p: Product, mode: "masuk" | "keluar") => {
    setMoveProduct(p);
    setMoveMode(mode);
    setMoveQty("");
    setMoveNote("");
    setMoveReason(tab === "panen" ? "rusak" : "terpakai");
    setFormError("");
  };

  const handleMove = async () => {
    if (!moveProduct || !moveQty || Number(moveQty) <= 0) return;
    const qty = Number(moveQty);
    if (moveMode === "keluar" && qty > moveProduct.stock) {
      setFormError("Stok tidak cukup! Tersedia: " + moveProduct.stock);
      return;
    }
    setMoveLoading(true);
    setFormError("");
    const newStock = moveMode === "masuk" ? moveProduct.stock + qty : Math.max(0, moveProduct.stock - qty);
    const isSap = isSaprotanCategory(moveProduct.category);
    const modal = Number(moveProduct.cost) || 0;

    const { error } = await supabase.from("products").update({ stock: newStock }).eq("id", moveProduct.id);
    if (error) {
      setFormError(error.message);
      setMoveLoading(false);
      return;
    }

    await supabase.from("stock_movements").insert({
      user_id: userId,
      product_id: moveProduct.id,
      type: moveMode,
      reason: moveMode === "keluar" ? moveReason : null,
      quantity: qty,
      note: moveNote || (moveMode === "masuk"
        ? (isSap ? "Beli saprotan" : "Hasil panen masuk")
        : (isSap ? "Pakai di lahan" : "Keluar panen")),
      profit_loss: moveMode === "keluar" && moveReason === "rusak" && modal ? -modal * qty : 0,
      movement_date: todayWib(),
    });

    if (moveMode === "masuk" && isSap && modal > 0) {
      await supabase.from("transactions").insert({
        user_id: userId, business_id: businessId,
        type: "pengeluaran", scope: "bisnis", category: "Pembelian Saprotan",
        description: `Beli ${moveProduct.name} x${qty}`,
        amount: modal * qty, transaction_date: todayWib(),
      });
    }

    setMoveLoading(false);
    setMoveProduct(null);
    router.refresh();
  };

  const handleJual = async () => {
    if (!sellingProduct || !sellQty || !sellPrice || !businessId) return;
    const qty = Number(sellQty);
    const harga = Number(sellPrice);
    if (qty <= 0 || harga <= 0) return;
    if (qty > sellingProduct.stock) { setFormError("Stok tidak cukup! Tersedia: " + sellingProduct.stock); return; }

    const hpp = calcAgriProductHpp(sellingProduct, hppPerUnit);
    if (hpp <= 0) {
      const ok = confirm("HPP belum kehitung — catat biaya produksi & saprotan di Modul Pertanian dulu.\n\nLanjut jual tanpa estimasi HPP?");
      if (!ok) return;
    }

    setSellLoading(true);
    setFormError("");
    const prevStock = sellingProduct.stock;
    try {
      const newStock = Math.max(0, prevStock - qty);
      const { error: stockErr } = await supabase.from("products").update({ stock: newStock }).eq("id", sellingProduct.id);
      if (stockErr) throw new Error(stockErr.message);

      try {
        const { totalJual, laba } = await recordAgriPenjualan(supabase, {
          userId, businessId, productName: sellingProduct.name, qty, harga,
          hppPerUnit: hpp, tanggal: today,
        });

        await supabase.from("stock_movements").insert({
          user_id: userId, product_id: sellingProduct.id, type: "keluar", reason: "terjual",
          quantity: qty, note: "Penjualan " + sellingProduct.name, profit_loss: laba, movement_date: today,
        });

        setSellingProduct(null);
        setSellSuccess({ nama: sellingProduct.name, total: totalJual, laba });
        router.refresh();
      } catch (financeErr) {
        await supabase.from("products").update({ stock: prevStock }).eq("id", sellingProduct.id);
        throw financeErr;
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Gagal menyimpan");
    }
    setSellLoading(false);
  };

  return (
    <div className="pb-24 md:pb-6">
      <AgriHubNav />

      <div className="mb-4 overflow-hidden rounded-2xl border border-[#84CC16]/25 bg-[#0C140A]">
        <div className="flex items-center gap-2 px-4 py-3">
          <Sprout size={16} className="text-[#84CC16]" />
          <p className="text-sm font-semibold text-[#F0EFF8]">Gudang Panen & Saprotan</p>
        </div>
        <p className="border-t border-white/[0.06] px-4 py-2 text-[11px] leading-relaxed text-[#8B8AA0]">
          Panen: Masuk / Keluar (rusak) / Jual. Saprotan: Masuk (beli) / Keluar (pakai lahan). Biaya produksi tetap di Modul Pertanian.
        </p>
      </div>

      {kritisSaprotan > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-400" />
          <p className="text-[11px] text-amber-300">{kritisSaprotan} saprotan stok menipis — restock lewat tab Saprotan atau <Link href="/dashboard/pertanian" className="text-[#2DD4BF] underline">Modul Pertanian</Link></p>
        </div>
      )}

      {hppBelumAda && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#F59E0B]/25 bg-[#F59E0B]/5 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-[#F59E0B]" />
          <p className="text-[11px] leading-relaxed text-[#F59E0B]">
            HPP belum kehitung — catat biaya di <Link href="/dashboard/pertanian" className="text-[#2DD4BF] underline">Modul Pertanian</Link>.
          </p>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={`${cardCls} p-4`}><p className="mb-1 text-xs text-[#8B8AA0]">Komoditas</p><p className="font-mono text-lg font-semibold text-[#84CC16]">{harvest.length}</p></div>
        <div className={`${cardCls} p-4`}><p className="mb-1 text-xs text-[#8B8AA0]">Stok panen</p><p className="font-mono text-lg font-semibold text-[#38BDF8]">{harvestStock}</p></div>
        <div className={`${cardCls} p-4`}><p className="mb-1 text-xs text-[#8B8AA0]">HPP/unit</p><p className="font-mono text-lg font-semibold text-[#8B5CF6]">{fmtRp(hppPerUnit)}</p></div>
        <div className={`${cardCls} p-4`}>
          <p className="mb-1 text-xs text-[#8B8AA0]">Profit hari ini</p>
          <p className="font-mono text-lg font-semibold" style={{ color: profitHariIni >= 0 ? "#84CC16" : "#EC4899" }}>{fmtRp(profitHariIni)}</p>
        </div>
      </div>

      {totalCost > 0 && (
        <p className="mb-4 text-center text-[10px] text-[#5A5B7A]">
          Total biaya {fmtRp(totalCost)} = Biaya {fmtRp(totalBiayaProduksi)} + Semprot {fmtRp(totalBiayaSemprot)} + Saprotan {fmtRp(saprotanCost)}
        </p>
      )}

      <RecentMovementsStrip movements={movements} accent={ACCENT} />

      {todaySales.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-white/[0.08]" style={{ background: "#0D0D1A" }}>
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <p className="text-sm font-medium text-[#F0EFF8]">Penjualan hari ini</p>
            <Link href="/dashboard/keuangan-bisnis" className="text-[10px] text-[#84CC16] underline">Keuangan →</Link>
          </div>
          {todaySales.map((s, i) => (
            <div key={i} className="flex items-center justify-between border-b border-white/[0.04] px-4 py-2.5 last:border-0">
              <p className="mr-3 flex-1 truncate text-xs text-[#8B8AA0]">{s.description || "Penjualan"}</p>
              <span className="font-mono text-xs font-semibold text-[#84CC16]">{fmtRp(Number(s.amount))}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <button type="button" onClick={() => setTab("panen")}
          className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
          style={tab === "panen" ? BTN_GRAD : { background: "rgba(255,255,255,0.04)", color: "#8B8AA0" }}>
          Panen ({harvest.length})
        </button>
        <button type="button" onClick={() => setTab("saprotan")}
          className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
          style={tab === "saprotan" ? { background: "linear-gradient(135deg, #F59E0B, #84CC16)", color: "#070711" } : { background: "rgba(255,255,255,0.04)", color: "#8B8AA0" }}>
          Saprotan ({saprotan.length})
        </button>
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8AA0]" />
            <input type="text" placeholder={tab === "panen" ? "Cari komoditas panen..." : "Cari saprotan..."} value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0A0A12] py-2 pl-8 pr-3 text-sm text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:border-[#84CC16]/50 focus:outline-none" />
          </div>
          <Link href="/dashboard/pertanian" className="whitespace-nowrap rounded-lg border border-[#84CC16]/30 px-3 py-2 text-[10px] text-[#84CC16]">
            + Modul Pertanian
          </Link>
        </div>

        {filtered.length === 0 ? (
          <FnbEmptyState
            icon={tab === "panen" ? ShoppingBag : Sprout}
            title={tab === "panen" ? "Belum ada hasil panen" : "Belum ada saprotan"}
            subtitle={tab === "panen" ? "Catat panen di Modul Pertanian — stok muncul di sini." : "Tambah pupuk/pestisida di Modul Pertanian, atau Masuk di sini."}
            actionLabel="Ke Modul Pertanian"
            actionHref="/dashboard/pertanian"
          />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((p) => {
              const isKritis = p.stock <= p.min_stock;
              const satuan = tab === "panen" ? getSatuan(p.id) : "pcs";
              const productHpp = tab === "panen" ? calcAgriProductHpp(p, hppPerUnit) : Number(p.cost || 0);
              const margin = tab === "panen" && p.price && productHpp > 0 ? Math.round(((p.price - productHpp) / p.price) * 100) : null;
              return (
                <div key={p.id} className="px-4 py-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{p.name}</p>
                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[#8B8AA0]">{p.category}</span>
                        {isKritis && <span className="rounded bg-[#F59E0B]/15 px-1.5 py-0.5 text-[10px] text-[#F59E0B]">Kritis</span>}
                      </div>
                      {tab === "panen" && (
                        <div className="mt-1 rounded-xl border border-[#84CC16]/20 px-3 py-2" style={{ background: "rgba(132,204,22,0.06)" }}>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div><p className="text-[9px] text-[#5A5B7A]">HPP/{satuan}</p><p className="font-mono font-semibold text-[#84CC16]">{productHpp > 0 ? fmtRp(productHpp) : "—"}</p></div>
                            <div><p className="text-[9px] text-[#5A5B7A]">Harga jual</p><p className="font-mono font-semibold text-[#F0EFF8]">{p.price ? fmtRp(p.price) : "—"}</p></div>
                            <div><p className="text-[9px] text-[#5A5B7A]">Margin</p><p className="font-mono font-semibold" style={{ color: margin !== null && margin >= 0 ? "#84CC16" : "#EC4899" }}>{margin !== null ? margin + "%" : "—"}</p></div>
                          </div>
                        </div>
                      )}
                      <p className="mt-1.5 text-[11px] text-[#8B8AA0]">Stok: <span className="font-mono text-[#F0EFF8]">{p.stock} {satuan}</span></p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => openMove(p, "masuk")} className="inline-flex items-center gap-1 rounded-lg bg-[#84CC16]/10 px-2.5 py-1.5 text-[11px] text-[#84CC16]">
                      <ArrowDownToLine size={12} /> Masuk
                    </button>
                    <button type="button" onClick={() => openMove(p, "keluar")} className="inline-flex items-center gap-1 rounded-lg bg-[#F59E0B]/10 px-2.5 py-1.5 text-[11px] text-[#F59E0B]">
                      <ArrowUpFromLine size={12} /> Keluar
                    </button>
                    {tab === "panen" && (
                      <button type="button" onClick={() => openSell(p)} disabled={p.stock <= 0}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-40" style={BTN_GRAD}>
                        <ShoppingBag size={12} /> Jual
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {moveProduct && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={() => setMoveProduct(null)}>
          <div
            className="w-full max-w-sm overflow-y-auto rounded-t-2xl border border-white/10 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
            style={{ background: "#0D0D1A" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-[#5A5B7A]">{moveMode === "masuk" ? "Masuk stok" : "Keluar stok"}</p>
                <h3 className="text-sm font-medium">{moveProduct.name}</h3>
              </div>
              <button type="button" onClick={() => setMoveProduct(null)} className="text-[#8B8AA0]"><X size={18} /></button>
            </div>
            <p className="mb-3 text-xs text-[#8B8AA0]">Stok: {moveProduct.stock}</p>
            <input className={inputCls + " mb-2"} type="number" placeholder="Jumlah *" value={moveQty} onChange={(e) => setMoveQty(e.target.value)} />
            {moveMode === "keluar" && (
              <select className={inputCls + " mb-2"} value={moveReason} onChange={(e) => setMoveReason(e.target.value)}>
                {tab === "panen" ? (
                  <>
                    <option value="rusak">Busuk / rusak</option>
                    <option value="lainnya">Lainnya</option>
                  </>
                ) : (
                  <>
                    <option value="terpakai">Pakai di lahan</option>
                    <option value="rusak">Rusak / hilang</option>
                    <option value="lainnya">Lainnya</option>
                  </>
                )}
              </select>
            )}
            <input className={inputCls + " mb-3"} placeholder="Catatan (opsional)" value={moveNote} onChange={(e) => setMoveNote(e.target.value)} />
            {formError && <p className="mb-2 text-xs text-[#EC4899]">{formError}</p>}
            <button type="button" onClick={handleMove} disabled={moveLoading || !moveQty} className="w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40" style={BTN_GRAD}>
              {moveLoading ? "Menyimpan..." : moveMode === "masuk" ? "Catat masuk" : "Catat keluar"}
            </button>
          </div>
        </div>
      )}

      {sellingProduct && (() => {
        const qty = Number(sellQty) || 0;
        const harga = Number(sellPrice) || 0;
        const unitHpp = calcAgriProductHpp(sellingProduct, hppPerUnit);
        const total = qty * harga;
        const totalHpp = qty * unitHpp;
        const laba = total - totalHpp;
        return (
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={() => setSellingProduct(null)}>
            <div className="w-full max-w-sm rounded-t-2xl border border-white/10 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl" style={{ background: "#0D0D1A" }} onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium">{sellingProduct.name}</h3>
                <button type="button" onClick={() => setSellingProduct(null)} className="text-[#8B8AA0]"><X size={18} /></button>
              </div>
              <p className="mb-3 text-xs text-[#8B8AA0]">Stok: {sellingProduct.stock} · HPP/{getSatuan(sellingProduct.id)}: {unitHpp > 0 ? fmtRp(unitHpp) : "belum dihitung"}</p>
              <div className="mb-3 flex flex-col gap-2">
                <input className={inputCls} type="number" placeholder="Jumlah terjual" value={sellQty} onChange={(e) => setSellQty(e.target.value)} />
                <input className={inputCls} type="number" placeholder="Harga jual per unit" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
              </div>
              {qty > 0 && harga > 0 && (
                <div className="mb-3 space-y-1 rounded-xl border border-white/[0.08] px-3 py-2 text-xs" style={{ background: "#0A0A12" }}>
                  <div className="flex justify-between"><span className="text-[#8B8AA0]">Total jual</span><span className="font-mono">{fmtRp(total)}</span></div>
                  {totalHpp > 0 && <div className="flex justify-between"><span className="text-[#8B8AA0]">Total HPP</span><span className="font-mono text-[#EC4899]">{fmtRp(totalHpp)}</span></div>}
                  <div className="flex justify-between"><span className="text-[#8B8AA0]">Laba</span><span className="font-mono text-[#84CC16]">{fmtRp(laba)}</span></div>
                </div>
              )}
              {formError && <p className="mb-2 text-xs text-[#EC4899]">{formError}</p>}
              <button type="button" onClick={handleJual} disabled={sellLoading || !sellQty || !sellPrice} className="w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40" style={BTN_GRAD}>
                {sellLoading ? "Menyimpan..." : "Simpan Penjualan"}
              </button>
            </div>
          </div>
        );
      })()}

      {sellSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#070711]/95 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#84CC16]/25 p-7 text-center" style={{ background: "#0D0D1A" }}>
            <Check size={24} className="mx-auto mb-3 text-[#84CC16]" />
            <p className="mb-1 text-base font-semibold text-[#84CC16]">Penjualan berhasil!</p>
            <p className="mb-4 text-xs text-[#5A5B7A]">{sellSuccess.nama} · Laba {fmtRp(sellSuccess.laba)}</p>
            <button type="button" onClick={() => setSellSuccess(null)} className="mb-2 w-full rounded-xl py-3 text-sm font-semibold" style={BTN_GRAD}>+ Jual lagi</button>
            <Link href="/dashboard/keuangan-bisnis" className="block text-xs text-[#8B8AA0] hover:text-[#84CC16]">Keuangan Bisnis →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
