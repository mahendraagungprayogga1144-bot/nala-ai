"use client";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Search, Plus, Minus, Trash2, X, Check, ShoppingCart,
  DollarSign, AlertTriangle, Package,
} from "lucide-react";
import type { Product, KasirShift } from "../page";
import { trackClientEvent } from "@/lib/admin/track-event";

type CartItem = { product: Product; qty: number };

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }

const METODE_BAYAR = [
  { val: "tunai", lbl: "Tunai" },
  { val: "qris", lbl: "QRIS" },
  { val: "transfer", lbl: "Transfer" },
  { val: "debit", lbl: "Debit" },
];

const BTN_GRAD = { background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" } as const;

export default function KasirPOS({
  userId, businessId, businessName, products, activeShift, today, omzetHariIni, totalOrder,
}: {
  userId: string; businessId: string; businessName: string;
  products: Product[]; activeShift: KasirShift | null;
  today: string; omzetHariIni: number; totalOrder: number;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("Semua");
  const [diskon, setDiskon] = useState("");
  const [metodeBayar, setMetodeBayar] = useState("tunai");
  const [bayar, setBayar] = useState("");
  const [loading, setLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category || "Lainnya"));
    return ["Semua", ...Array.from(cats).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter(p =>
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
       (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
       (p.barcode && p.barcode.includes(search))) &&
      (activeCat === "Semua" || (p.category || "Lainnya") === activeCat)
    );
  }, [products, search, activeCat]);

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return prev;
        return prev.map(c => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      }
      if (product.stock <= 0) return prev;
      return [...prev, { product, qty: 1 }];
    });
  }, []);

  const decFromCart = useCallback((productId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === productId);
      if (!existing) return prev;
      if (existing.qty <= 1) return prev.filter(c => c.product.id !== productId);
      return prev.map(c => c.product.id === productId ? { ...c, qty: c.qty - 1 } : c);
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(c => c.product.id !== productId));
  }, []);

  const getQty = (productId: string) => cart.find(c => c.product.id === productId)?.qty || 0;
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const subtotal = cart.reduce((s, c) => s + (c.product.price || 0) * c.qty, 0);
  const totalHpp = cart.reduce((s, c) => s + (c.product.cost || 0) * c.qty, 0);
  const diskonNum = Number(diskon) || 0;
  const total = Math.max(0, subtotal - diskonNum);
  const laba = total - totalHpp;
  const margin = total > 0 ? Math.round((laba / total) * 100) : 0;
  const bayarNum = Number(bayar) || 0;
  const kembali = metodeBayar === "tunai" && bayarNum > total ? bayarNum - total : 0;

  const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= p.min_stock);

  const resetOrder = () => {
    setCart([]); setDiskon(""); setBayar(""); setMetodeBayar("tunai"); setCartOpen(false);
  };

  const handleProses = async () => {
    if (loading) return;
    if (cart.length === 0) return;

    const overStock = cart.filter(c => c.qty > c.product.stock);
    if (overStock.length > 0) {
      alert(`Stok tidak cukup: ${overStock.map(c => `${c.product.name} (sisa ${c.product.stock})`).join(", ")}`);
      return;
    }

    setLoading(true);

    const { data: order, error } = await supabase.from("orders").insert({
      user_id: userId, business_id: businessId,
      total, diskon: diskonNum, hpp: totalHpp, laba,
      metode_bayar: metodeBayar, catatan: `AI Kasir — ${metodeBayar}`,
      order_date: today,
    }).select("id").single();

    if (error || !order) {
      alert("Gagal simpan order: " + error?.message);
      setLoading(false);
      return;
    }

    const items = cart.map(c => ({
      order_id: order.id,
      product_id: c.product.id,
      qty: c.qty,
      harga_jual: c.product.price,
      hpp: c.product.cost || 0,
      laba: ((c.product.price || 0) - (c.product.cost || 0)) * c.qty,
    }));
    await supabase.from("order_items").insert(items);

    await supabase.from("transactions").insert({
      user_id: userId, business_id: businessId,
      type: "pemasukan", scope: "bisnis",
      category: "Penjualan",
      description: cart.map(c => c.product.name + " x" + c.qty).join(", "),
      amount: total, transaction_date: today,
    });

    for (const c of cart) {
      const newStock = Math.max(0, c.product.stock - c.qty);
      await supabase.from("products").update({ stock: newStock }).eq("id", c.product.id);
      const itemLaba = ((c.product.price || 0) - (c.product.cost || 0)) * c.qty;
      await supabase.from("stock_movements").insert({
        user_id: userId,
        product_id: c.product.id,
        type: "keluar",
        reason: "terjual",
        quantity: c.qty,
        note: `AI Kasir — ${metodeBayar}`,
        profit_loss: itemLaba,
        movement_date: today,
      });
    }

    if (activeShift) {
      await supabase.from("kasir_shifts").update({
        total_transaksi: Number(activeShift.total_transaksi) + total,
        total_order: Number(activeShift.total_order) + 1,
      }).eq("id", activeShift.id);
    }

    trackClientEvent({
      event: "ai_kasir_sale",
      module: "ai_kasir",
      business_id: businessId,
      meta: { total, items: cart.length, metode: metodeBayar },
    });

    setSuccessMsg(`Transaksi ${fmtRp(total)} berhasil!`);
    setTimeout(() => setSuccessMsg(null), 3000);
    resetOrder();
    setLoading(false);
    router.refresh();
  };

  const inputCls = "w-full rounded-xl border border-white/[0.08] bg-[#0A0A12] px-3 py-2.5 text-sm text-[#F0EFF8] outline-none focus:border-[#2DD4BF]/40 transition-colors";

  return (
    <div>
      {/* KPI bar */}
      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Omzet hari ini", value: fmtRp(omzetHariIni), color: "#2DD4BF", icon: DollarSign },
          { label: "Total order", value: String(totalOrder), color: "#8B5CF6", icon: ShoppingCart },
          { label: "Margin rata²", value: margin > 0 ? margin + "%" : "—", color: "#F59E0B", icon: Package },
        ].map(k => (
          <div key={k.label} className="rounded-2xl border p-3 sm:p-4" style={{ borderColor: k.color + "33", background: "#0D0D1A" }}>
            <div className="mb-1 flex items-center gap-1.5">
              <k.icon size={12} style={{ color: k.color }} />
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-[#8B8AA0]">{k.label}</p>
            </div>
            <p className="text-sm sm:text-lg font-bold" style={{ color: k.color, fontFamily: "'JetBrains Mono', monospace" }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Low stock alert */}
      {lowStockProducts.length > 0 && (
        <div className="mb-4 rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-[#F59E0B]" />
            <p className="text-xs font-semibold text-[#F59E0B]">Stok Hampir Habis</p>
          </div>
          <p className="text-[10px] text-[#8B8AA0]">
            {lowStockProducts.slice(0, 5).map(p => `${p.name} (${p.stock})`).join(" · ")}
            {lowStockProducts.length > 5 && ` +${lowStockProducts.length - 5} lainnya`}
          </p>
        </div>
      )}

      {/* Shift warning */}
      {!activeShift && (
        <div className="mb-4 rounded-xl border border-dashed border-[#F59E0B]/30 bg-[#F59E0B]/5 p-3 text-center text-xs text-[#F59E0B]">
          Belum buka shift. Buka shift dulu di tab Shift untuk tracking kas.
        </div>
      )}

      {/* Main layout: Grid + Cart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Product grid */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.08]" style={{ background: "#0D0D1A" }}>
          <div className="border-b border-white/[0.06] p-3 sm:p-4">
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0A0A12] px-3 py-2.5">
              <Search size={14} className="flex-shrink-0 text-[#2DD4BF]" />
              <input type="text" placeholder="Cari produk, SKU, atau scan barcode..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-[#F0EFF8] placeholder:text-[#3A3B52] focus:outline-none" />
              {search && <button type="button" onClick={() => setSearch("")} className="text-[#5A5B7A]"><X size={14} /></button>}
            </div>
            <div className="mt-2 flex gap-1.5 overflow-x-auto scrollbar-none">
              {categories.map(cat => (
                <button key={cat} onClick={() => setActiveCat(cat)}
                  className={"text-[11px] px-3 py-1.5 rounded-full border whitespace-nowrap font-medium transition-colors " +
                    (activeCat === cat
                      ? "border-[#2DD4BF]/50 text-[#2DD4BF] bg-[#2DD4BF]/15"
                      : "border-white/[0.06] text-[#5A5B7A] hover:text-[#8B8AA0]")}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 max-h-[60vh] overflow-y-auto scrollbar-none">
            {filtered.length === 0 ? (
              <div className="col-span-full py-10 text-center text-sm text-[#3A3B52]">
                {products.length === 0 ? "Belum ada produk. Tambah di Inventory." : "Tidak ditemukan."}
              </div>
            ) : filtered.map(p => {
              const qty = getQty(p.id);
              const outOfStock = p.stock <= 0;
              return (
                <div key={p.id}
                  className={"cursor-pointer overflow-hidden rounded-2xl border transition-shadow active:scale-[0.98] " +
                    (outOfStock ? "opacity-50 cursor-not-allowed" : "")}
                  style={{
                    borderColor: qty > 0 ? "rgba(45,212,191,.45)" : "rgba(255,255,255,0.06)",
                    boxShadow: qty > 0 ? "0 0 0 1px rgba(45,212,191,.3), 0 8px 24px rgba(45,212,191,.1)" : "none",
                    background: "#0A0A14",
                  }}
                  onClick={() => !outOfStock && addToCart(p)}>
                  <div className="flex items-center justify-center py-5"
                    style={{ background: qty > 0 ? "rgba(45,212,191,.08)" : "rgba(255,255,255,.02)" }}>
                    <Package size={28} style={{ color: qty > 0 ? "#2DD4BF" : "#3A3B52" }} />
                  </div>
                  <div className="p-2.5 sm:p-3">
                    {p.category && (
                      <span className="mb-1 inline-block rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-[#5A5B7A]">
                        {p.category}
                      </span>
                    )}
                    <p className="mb-0.5 truncate text-sm font-medium text-[#F0EFF8]">{p.name}</p>
                    <p className="mb-2 text-[9px] text-[#5A5B7A]">
                      Stok: {p.stock}{p.sku ? ` · ${p.sku}` : ""}
                    </p>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold sm:text-sm" style={{ color: "#2DD4BF", fontFamily: "'JetBrains Mono', monospace" }}>
                        {fmtRp(p.price || 0)}
                      </p>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button type="button" onClick={() => decFromCart(p.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border sm:h-6 sm:w-6"
                          style={qty > 0
                            ? { borderColor: "rgba(45,212,191,.4)", color: "#2DD4BF", background: "rgba(45,212,191,.08)" }
                            : { borderColor: "rgba(255,255,255,.06)", color: "#3A3B52" }}>
                          <Minus size={11} />
                        </button>
                        <span className="w-5 text-center text-xs font-medium"
                          style={{ color: qty > 0 ? "#2DD4BF" : "#3A3B52", fontFamily: "monospace" }}>{qty}</span>
                        <button type="button" onClick={() => addToCart(p)}
                          disabled={outOfStock || qty >= p.stock}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border sm:h-6 sm:w-6 disabled:opacity-30"
                          style={{ borderColor: "rgba(45,212,191,.4)", color: "#2DD4BF", background: "rgba(45,212,191,.08)" }}>
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop cart panel */}
        <div className="hidden lg:block rounded-2xl border border-white/[0.08] overflow-hidden h-fit" style={{ background: "#0D0D1A" }}>
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[#2DD4BF]">Keranjang ({cartCount})</p>
          </div>

          <CartPanel
            cart={cart} subtotal={subtotal} total={total} totalHpp={totalHpp}
            laba={laba} margin={margin} diskon={diskon} setDiskon={setDiskon}
            metodeBayar={metodeBayar} setMetodeBayar={setMetodeBayar}
            bayar={bayar} setBayar={setBayar} kembali={kembali}
            loading={loading} onProses={handleProses} onReset={resetOrder}
            onAdd={addToCart} onDec={decFromCart} onRemove={removeFromCart}
            inputCls={inputCls}
          />
        </div>
      </div>

      {/* Mobile cart bar */}
      {cart.length > 0 && !cartOpen && (
        <button type="button" onClick={() => setCartOpen(true)}
          className="lg:hidden fixed left-4 right-4 bottom-20 z-[45] flex items-center justify-between rounded-2xl px-4 py-3.5 active:scale-[0.98]"
          style={{ ...BTN_GRAD, boxShadow: "0 8px 32px rgba(45,212,191,.3)" }}>
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#050508]/25 text-xs font-bold">{cartCount}</span>
            Lihat order
          </span>
          <span className="font-mono text-sm font-bold">{fmtRp(total)}</span>
        </button>
      )}

      {/* Mobile cart sheet */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end bg-[#050508]/80 backdrop-blur-sm" onClick={() => setCartOpen(false)}>
          <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl border border-[#2DD4BF]/30 border-b-0 bg-[#1A1A28] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-[#2DD4BF]">Keranjang ({cartCount})</p>
              <button type="button" onClick={() => setCartOpen(false)} className="rounded-full bg-white/5 p-2 text-[#8B8AA0]">
                <X size={16} />
              </button>
            </div>
            <CartPanel
              cart={cart} subtotal={subtotal} total={total} totalHpp={totalHpp}
              laba={laba} margin={margin} diskon={diskon} setDiskon={setDiskon}
              metodeBayar={metodeBayar} setMetodeBayar={setMetodeBayar}
              bayar={bayar} setBayar={setBayar} kembali={kembali}
              loading={loading} onProses={handleProses} onReset={resetOrder}
              onAdd={addToCart} onDec={decFromCart} onRemove={removeFromCart}
              inputCls={inputCls} compact
            />
          </div>
        </div>
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="fixed bottom-24 left-1/2 z-[105] -translate-x-1/2 rounded-full border border-[#2DD4BF]/30 bg-[#0D0D1A] px-5 py-2.5 text-xs font-medium text-[#2DD4BF] shadow-lg">
          <Check size={12} className="inline mr-1.5" />{successMsg}
        </div>
      )}
    </div>
  );
}

function CartPanel({
  cart, subtotal, total, totalHpp, laba, margin, diskon, setDiskon,
  metodeBayar, setMetodeBayar, bayar, setBayar, kembali,
  loading, onProses, onReset, onAdd, onDec, onRemove, inputCls, compact,
}: {
  cart: CartItem[]; subtotal: number; total: number; totalHpp: number;
  laba: number; margin: number; diskon: string; setDiskon: (v: string) => void;
  metodeBayar: string; setMetodeBayar: (v: string) => void;
  bayar: string; setBayar: (v: string) => void; kembali: number;
  loading: boolean; onProses: () => void; onReset: () => void;
  onAdd: (p: Product) => void; onDec: (id: string) => void; onRemove: (id: string) => void;
  inputCls: string; compact?: boolean;
}) {
  const pad = compact ? "" : "px-4 py-3";

  return (
    <div>
      {/* Items */}
      <div className={pad + (compact ? "" : " border-b border-white/[0.06]")}>
        {cart.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#3A3B52]">Pilih produk dulu</p>
        ) : (
          <div className="flex flex-col gap-2 mb-3">
            {cart.map(c => (
              <div key={c.product.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 min-w-0 truncate text-[#8B8AA0]">{c.product.name}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => onDec(c.product.id)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center border border-white/[0.08] text-[#8B8AA0]">
                    <Minus size={10} />
                  </button>
                  <span className="w-5 text-center font-mono text-[#F0EFF8]">{c.qty}</span>
                  <button type="button" onClick={() => onAdd(c.product)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center border border-[#2DD4BF]/40 text-[#2DD4BF] bg-[#2DD4BF]/[0.08]">
                    <Plus size={10} />
                  </button>
                </div>
                <span className="font-mono text-[#C4C3D4] w-20 text-right">{fmtRp((c.product.price || 0) * c.qty)}</span>
                <button type="button" onClick={() => onRemove(c.product.id)} className="text-[#5A5B7A] hover:text-[#EC4899]">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="h-px bg-white/[0.06] mb-2" />
        <div className="flex justify-between text-xs mb-1"><span className="text-[#5A5B7A]">Subtotal</span><span className="font-mono text-[#C4C3D4]">{fmtRp(subtotal)}</span></div>
        <div className="flex justify-between items-center text-xs mb-2">
          <span className="text-[#5A5B7A]">Diskon</span>
          <input type="number" placeholder="0" value={diskon} onChange={e => setDiskon(e.target.value)}
            className="w-24 text-right text-xs px-2 py-1 rounded-lg border border-white/[0.08] bg-[#0A0A12] text-[#F0EFF8] focus:outline-none font-mono" />
        </div>
        <div className="h-px bg-white/[0.06] mb-2" />
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-sm font-medium text-[#F0EFF8]">Total</span>
          <span className="text-base font-semibold text-[#2DD4BF]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(total)}</span>
        </div>
        <p className="text-[10px] text-[#5A5B7A]">Laba <span className="text-[#2DD4BF]">{fmtRp(laba)}</span> · margin {margin}%</p>
      </div>

      {/* Metode bayar */}
      <div className={compact ? "pt-3" : "px-4 py-3 border-b border-white/[0.06]"}>
        <p className="text-[10px] text-[#5A5B7A] uppercase tracking-widest mb-2">Metode Bayar</p>
        <div className="grid grid-cols-4 gap-1.5">
          {METODE_BAYAR.map(m => (
            <button key={m.val} type="button" onClick={() => setMetodeBayar(m.val)}
              className="py-2 rounded-lg border text-center text-[11px] font-medium"
              style={metodeBayar === m.val
                ? { borderColor: "rgba(45,212,191,.45)", color: "#2DD4BF", background: "rgba(45,212,191,.08)" }
                : { borderColor: "rgba(255,255,255,.06)", color: "#5A5B7A" }}>
              {m.lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Tunai input */}
      {metodeBayar === "tunai" && cart.length > 0 && (
        <div className={compact ? "pt-3" : "px-4 py-3 border-b border-white/[0.06]"}>
          <p className="text-[10px] text-[#5A5B7A] uppercase tracking-widest mb-2">Bayar Tunai (Rp)</p>
          <input type="number" placeholder={String(Math.ceil(total / 1000) * 1000)}
            value={bayar} onChange={e => setBayar(e.target.value)} className={inputCls + " font-mono"} />
          {kembali > 0 && (
            <p className="mt-1.5 text-xs text-[#2DD4BF]">Kembali <span className="font-mono font-semibold">{fmtRp(kembali)}</span></p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className={compact ? "pt-4 flex flex-col gap-2" : "px-4 py-4 flex flex-col gap-2"}>
        <button type="button" onClick={onProses} disabled={loading || cart.length === 0}
          className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          style={BTN_GRAD}>
          <Check size={15} />
          {loading ? "Memproses..." : `Bayar — ${fmtRp(total)}`}
        </button>
        <button type="button" onClick={onReset}
          className="w-full py-2 rounded-xl text-xs border font-medium"
          style={{ borderColor: "rgba(236,72,153,.25)", color: "#EC4899", background: "rgba(236,72,153,.05)" }}>
          Batal order
        </button>
      </div>
    </div>
  );
}
