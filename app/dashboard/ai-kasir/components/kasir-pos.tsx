"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Search, Plus, Minus, Trash2, X, Check, ShoppingCart,
  DollarSign, AlertTriangle, Package, Pause, Play,
} from "lucide-react";
import type { Product, KasirShift } from "../page";
import { trackClientEvent } from "@/lib/admin/track-event";
import { checkoutProductSale } from "@/lib/pos/checkout-product-sale";
import { isRetailSellable } from "@/lib/pos/retail-sellable";
import { printRetailReceipt } from "@/lib/pos/retail-receipt";

type CartItem = { product: Product; qty: number };

type HeldOrder = {
  id: string;
  label: string;
  lines: { productId: string; qty: number }[];
  diskon: string;
  metodeBayar: string;
  heldAt: string;
};

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }

function holdsKey(businessId: string) {
  return `retail_kasir_holds_${businessId}`;
}

const METODE_BAYAR = [
  { val: "tunai", lbl: "Tunai" },
  { val: "qris", lbl: "QRIS" },
  { val: "transfer", lbl: "Transfer" },
  { val: "debit", lbl: "Debit" },
];

const BTN_GRAD = { background: "#007A4D", color: "#FFFFFF" } as const;

export default function KasirPOS({
  userId, businessId, businessName, products, activeShift, today, omzetHariIni, totalOrder, staffName, onGoProduk,
}: {
  userId: string; businessId: string; businessName: string;
  products: Product[]; activeShift: KasirShift | null;
  today: string; omzetHariIni: number; totalOrder: number;
  staffName?: string | null;
  onGoProduk?: () => void;
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
  /** Retail POS: default hanya SKU siap jual (harga > 0, bukan bahan baku). */
  const [showAllStock, setShowAllStock] = useState(false);
  const [holds, setHolds] = useState<HeldOrder[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(holdsKey(businessId));
      if (raw) setHolds(JSON.parse(raw) as HeldOrder[]);
    } catch { /* ignore */ }
  }, [businessId]);

  const persistHolds = (next: HeldOrder[]) => {
    setHolds(next);
    try {
      localStorage.setItem(holdsKey(businessId), JSON.stringify(next));
    } catch { /* ignore */ }
  };

  const sellablePool = useMemo(
    () => (showAllStock ? products : products.filter(isRetailSellable)),
    [products, showAllStock],
  );

  const categories = useMemo(() => {
    const cats = new Set(sellablePool.map((p) => p.category || "Lainnya"));
    return ["Semua", ...Array.from(cats).sort()];
  }, [sellablePool]);

  const filtered = useMemo(() => {
    return sellablePool.filter(
      (p) =>
        (p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
          (p.barcode && p.barcode.includes(search))) &&
        (activeCat === "Semua" || (p.category || "Lainnya") === activeCat),
    );
  }, [sellablePool, search, activeCat]);

  const addToCart = useCallback((product: Product) => {
    if ((Number(product.price) || 0) <= 0) {
      alert("Produk ini belum punya harga jual. Set harga di Inventory dulu — kasir retail hanya jual SKU berharga.");
      return;
    }
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return prev;
        return prev.map((c) => (c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c));
      }
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

  const holdOrder = () => {
    if (cart.length === 0) return;
    const label = cart.map((c) => c.product.name).slice(0, 2).join(", ") +
      (cart.length > 2 ? ` +${cart.length - 2}` : "");
    const next: HeldOrder = {
      id: crypto.randomUUID(),
      label,
      lines: cart.map((c) => ({ productId: c.product.id, qty: c.qty })),
      diskon,
      metodeBayar,
      heldAt: new Date().toISOString(),
    };
    persistHolds([next, ...holds].slice(0, 12));
    resetOrder();
    setSuccessMsg("Order diparkir. Panggil lagi kapan saja.");
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const recallHold = (h: HeldOrder) => {
    const restored: CartItem[] = [];
    const missing: string[] = [];
    for (const line of h.lines) {
      const product = products.find((p) => p.id === line.productId);
      if (!product) {
        missing.push(line.productId.slice(0, 6));
        continue;
      }
      const qty = Math.min(line.qty, Math.max(0, product.stock));
      if (qty <= 0) {
        missing.push(product.name);
        continue;
      }
      restored.push({ product, qty });
    }
    if (restored.length === 0) {
      alert("Tidak bisa panggil hold — produk hilang atau stok habis.");
      return;
    }
    if (cart.length > 0 && !confirm("Keranjang sekarang akan diganti dengan order yang diparkir. Lanjut?")) {
      return;
    }
    setCart(restored);
    setDiskon(h.diskon || "");
    setMetodeBayar(h.metodeBayar || "tunai");
    setBayar("");
    persistHolds(holds.filter((x) => x.id !== h.id));
    if (missing.length) {
      alert(`Sebagian item tidak dimuat (stok/produk): ${missing.slice(0, 3).join(", ")}`);
    }
  };

  const dropHold = (id: string) => {
    persistHolds(holds.filter((x) => x.id !== id));
  };

  const handleProses = async () => {
    if (loading) return;
    if (cart.length === 0) return;

    const zeroPrice = cart.filter((c) => (Number(c.product.price) || 0) <= 0);
    if (zeroPrice.length > 0) {
      alert(`Harga jual belum diisi: ${zeroPrice.map((c) => c.product.name).join(", ")}`);
      return;
    }

    const overStock = cart.filter((c) => c.qty > c.product.stock);
    if (overStock.length > 0) {
      alert(`Stok tidak cukup: ${overStock.map((c) => `${c.product.name} (sisa ${c.product.stock})`).join(", ")}`);
      return;
    }

    setLoading(true);

    const result = await checkoutProductSale(supabase, {
      userId,
      businessId,
      lines: cart.map((c) => ({
        productId: c.product.id,
        name: c.product.name,
        qty: c.qty,
        price: c.product.price || 0,
        cost: c.product.cost || 0,
        expectedStock: c.product.stock,
      })),
      total,
      diskon: diskonNum,
      hpp: totalHpp,
      laba,
      metodeBayar,
      today,
      shiftId: activeShift?.id || null,
      shiftTotal: activeShift ? Number(activeShift.total_transaksi) : 0,
      shiftOrders: activeShift ? Number(activeShift.total_order) : 0,
      skipFinance: true,
      staffName: staffName || null,
    });

    if (!result.ok) {
      alert(result.error);
      setLoading(false);
      return;
    }

    trackClientEvent({
      event: "ai_kasir_sale",
      module: "ai_kasir",
      business_id: businessId,
      meta: { total, items: cart.length, metode: metodeBayar },
    });

    // Struk retail sederhana (window print) — bukan struk F&B
    printRetailReceipt({
      storeName: businessName || "AI Kasir",
      today,
      metodeBayar,
      staffName,
      lines: cart.map((c) => ({
        name: c.product.name,
        qty: c.qty,
        price: c.product.price || 0,
      })),
      total,
      diskon: diskonNum,
    });

    setSuccessMsg(`Transaksi ${fmtRp(total)} berhasil!`);
    setTimeout(() => setSuccessMsg(null), 3000);
    resetOrder();
    setLoading(false);
    router.refresh();
  };

  const inputCls = "w-full rounded-xl border border-[#C5D4CB] bg-white px-3 py-2.5 text-sm text-[#0F1F17] outline-none focus:ring-2 focus:ring-[#007A4D]/25 transition-colors";

  return (
    <div>
      {/* KPI bar */}
      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Omzet hari ini", value: fmtRp(omzetHariIni), color: "#007A4D", icon: DollarSign },
          { label: "Total order", value: String(totalOrder), color: "#0F1F17", icon: ShoppingCart },
          { label: "Margin rata²", value: margin > 0 ? margin + "%" : "—", color: "#B45309", icon: Package },
        ].map(k => (
          <div key={k.label} className="rounded-2xl border p-3 sm:p-4" style={{ borderColor: k.color + "33", background: "#FFFFFF" }}>
            <div className="mb-1 flex items-center gap-1.5">
              <k.icon size={12} style={{ color: k.color }} />
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-[#5C6B63]">{k.label}</p>
            </div>
            <p className="text-sm sm:text-lg font-bold" style={{ color: k.color, fontFamily: "ui-monospace, monospace" }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Low stock alert */}
      {lowStockProducts.length > 0 && (
        <div className="mb-4 rounded-xl border border-[#B45309]/25 bg-[#B45309]/8 p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-[#B45309]" />
            <p className="text-xs font-semibold text-[#B45309]">Stok Hampir Habis</p>
          </div>
          <p className="text-[10px] text-[#5C6B63]">
            {lowStockProducts.slice(0, 5).map(p => `${p.name} (${p.stock})`).join(" · ")}
            {lowStockProducts.length > 5 && ` +${lowStockProducts.length - 5} lainnya`}
          </p>
        </div>
      )}

      {/* Shift warning */}
      {!activeShift && (
        <div className="mb-4 rounded-xl border border-dashed border-[#B45309]/35 bg-[#B45309]/8 p-3 text-center text-xs text-[#B45309]">
          Belum buka shift. Buka shift dulu di tab Shift untuk tracking kas.
        </div>
      )}

      {/* Held / parked orders */}
      {holds.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[#C5D4CB] bg-white p-3 shadow-sm">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#5C6B63]">
            Order diparkir ({holds.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {holds.map((h) => (
              <div
                key={h.id}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#007A4D]/25 bg-[#F2FBF6] px-2.5 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => recallHold(h)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#007A4D]"
                  title="Panggil ke keranjang"
                >
                  <Play size={11} />
                  {h.label}
                  <span className="font-mono font-normal text-[#5C6B63]">
                    · {new Date(h.heldAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => dropHold(h.id)}
                  className="rounded p-0.5 text-[#8A9A90] hover:text-[#B42318]"
                  title="Buang hold"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main layout: Grid + Cart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Product grid */}
        <div className="overflow-hidden rounded-2xl border border-[#C5D4CB]" style={{ background: "#FFFFFF" }}>
          <div className="border-b border-[#E3EBE6] p-3 sm:p-4">
            <div className="flex items-center gap-3 rounded-xl border border-[#C5D4CB] bg-white px-3 py-2.5">
              <Search size={14} className="flex-shrink-0 text-[#007A4D]" />
              <input type="text" placeholder="Cari produk, SKU, atau scan barcode..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-[#0F1F17] placeholder:text-[#8A9A90] focus:outline-none" />
              {search && <button type="button" onClick={() => setSearch("")} className="text-[#5C6B63]"><X size={14} /></button>}
            </div>
            <div className="mt-2 flex gap-1.5 overflow-x-auto scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className={
                    "text-[11px] px-3 py-1.5 rounded-full border whitespace-nowrap font-medium transition-colors " +
                    (activeCat === cat
                      ? "border-[#007A4D]/50 text-[#007A4D] bg-[#007A4D]/12"
                      : "border-[#E3EBE6] text-[#5C6B63] hover:text-[#5C6B63]")
                  }
                >
                  {cat}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setShowAllStock((v) => !v);
                  setActiveCat("Semua");
                }}
                className={
                  "text-[11px] px-3 py-1.5 rounded-full border whitespace-nowrap font-medium transition-colors " +
                  (showAllStock
                    ? "border-[#B45309]/50 text-[#B45309] bg-[#B45309]/10"
                    : "border-[#E3EBE6] text-[#5C6B63] hover:text-[#5C6B63]")
                }
              >
                {showAllStock ? "Mode: semua stok" : "Mode: siap jual"}
              </button>
            </div>
            {!showAllStock && (
              <p className="mt-2 text-[10px] text-[#5C6B63]">
                Menampilkan SKU siap jual (harga &gt; 0, bukan bahan baku). Set harga di Inventory untuk muncul di kasir.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 max-h-[60vh] overflow-y-auto scrollbar-none">
            {filtered.length === 0 ? (
              <div className="col-span-full py-10 text-center">
                <Package size={28} className="mx-auto mb-2 text-[#8A9A90]" />
                <p className="mb-3 text-sm text-[#5C6B63]">
                  {products.length === 0
                    ? "Belum ada produk di toko ini."
                    : showAllStock
                      ? "Tidak ditemukan."
                      : "Belum ada produk siap jual (harga > 0)."}
                </p>
                {onGoProduk && (
                  <button
                    type="button"
                    onClick={onGoProduk}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#007A4D] px-4 py-2.5 text-xs font-semibold text-white"
                  >
                    <Plus size={13} /> Tambah produk dulu →
                  </button>
                )}
              </div>
            ) : filtered.map((p) => {
              const qty = getQty(p.id);
              const outOfStock = p.stock <= 0;
              const noPrice = (Number(p.price) || 0) <= 0;
              return (
                <div key={p.id}
                  className={"cursor-pointer overflow-hidden rounded-2xl border transition-shadow active:scale-[0.98] " +
                    (outOfStock || noPrice ? "opacity-50" : "")}
                  style={{
                    borderColor: qty > 0 ? "rgba(0,122,77,.45)" : "rgba(255,255,255,0.06)",
                    boxShadow: qty > 0 ? "0 0 0 1px rgba(0,122,77,.3), 0 8px 24px rgba(0,122,77,.1)" : "none",
                    background: "#F7FAF8",
                  }}
                  onClick={() => !outOfStock && addToCart(p)}>
                  <div className="flex items-center justify-center py-5"
                    style={{ background: qty > 0 ? "rgba(0,122,77,.08)" : "rgba(255,255,255,.02)" }}>
                    <Package size={28} style={{ color: qty > 0 ? "#007A4D" : "#8A9A90" }} />
                  </div>
                  <div className="p-2.5 sm:p-3">
                    {p.category && (
                      <span className="mb-1 inline-block rounded-full bg-[#E3EBE6] px-2 py-0.5 text-[9px] text-[#5C6B63]">
                        {p.category}
                      </span>
                    )}
                    <p className="mb-0.5 truncate text-sm font-medium text-[#0F1F17]">{p.name}</p>
                    <p className="mb-2 text-[9px] text-[#5C6B63]">
                      Stok: {p.stock}{p.sku ? ` · ${p.sku}` : ""}{noPrice ? " · tanpa harga" : ""}
                    </p>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold sm:text-sm" style={{ color: "#007A4D", fontFamily: "ui-monospace, monospace" }}>
                        {fmtRp(p.price || 0)}
                      </p>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button type="button" onClick={() => decFromCart(p.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border sm:h-6 sm:w-6"
                          style={qty > 0
                            ? { borderColor: "rgba(0,122,77,.4)", color: "#007A4D", background: "rgba(0,122,77,.08)" }
                            : { borderColor: "rgba(255,255,255,.06)", color: "#8A9A90" }}>
                          <Minus size={11} />
                        </button>
                        <span className="w-5 text-center text-xs font-medium"
                          style={{ color: qty > 0 ? "#007A4D" : "#8A9A90", fontFamily: "monospace" }}>{qty}</span>
                        <button type="button" onClick={() => addToCart(p)}
                          disabled={outOfStock || noPrice || qty >= p.stock}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border sm:h-6 sm:w-6 disabled:opacity-30"
                          style={{ borderColor: "rgba(0,122,77,.4)", color: "#007A4D", background: "rgba(0,122,77,.08)" }}>
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
        <div className="hidden lg:block rounded-2xl border border-[#C5D4CB] overflow-hidden h-fit" style={{ background: "#FFFFFF" }}>
          <div className="border-b border-[#E3EBE6] px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[#007A4D]">Keranjang ({cartCount})</p>
          </div>

          <CartPanel
            cart={cart} subtotal={subtotal} total={total} totalHpp={totalHpp}
            laba={laba} margin={margin} diskon={diskon} setDiskon={setDiskon}
            metodeBayar={metodeBayar} setMetodeBayar={setMetodeBayar}
            bayar={bayar} setBayar={setBayar} kembali={kembali}
            loading={loading} onProses={handleProses} onReset={resetOrder}
            onHold={holdOrder}
            onAdd={addToCart} onDec={decFromCart} onRemove={removeFromCart}
            inputCls={inputCls}
          />
        </div>
      </div>

      {/* Mobile cart bar */}
      {cart.length > 0 && !cartOpen && (
        <button type="button" onClick={() => setCartOpen(true)}
          className="lg:hidden fixed left-4 right-4 bottom-20 z-[45] flex items-center justify-between rounded-2xl px-4 py-3.5 active:scale-[0.98]"
          style={{ ...BTN_GRAD, boxShadow: "0 8px 32px rgba(0,122,77,.3)" }}>
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/20 text-xs font-bold">{cartCount}</span>
            Lihat order
          </span>
          <span className="font-mono text-sm font-bold">{fmtRp(total)}</span>
        </button>
      )}

      {/* Mobile cart sheet */}
      {cartOpen && (
        <div className="fixed inset-0 z-[80] flex items-end bg-[#0F1F17]/50 backdrop-blur-sm lg:hidden" onClick={() => setCartOpen(false)}>
          <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl border border-[#007A4D]/30 border-b-0 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#C5D4CB]" />
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-[#007A4D]">Keranjang ({cartCount})</p>
              <button type="button" onClick={() => setCartOpen(false)} className="rounded-full bg-[#F2F6F4] p-2 text-[#5C6B63]">
                <X size={16} />
              </button>
            </div>
            <CartPanel
              cart={cart} subtotal={subtotal} total={total} totalHpp={totalHpp}
              laba={laba} margin={margin} diskon={diskon} setDiskon={setDiskon}
              metodeBayar={metodeBayar} setMetodeBayar={setMetodeBayar}
              bayar={bayar} setBayar={setBayar} kembali={kembali}
              loading={loading} onProses={handleProses} onReset={resetOrder}
              onHold={holdOrder}
              onAdd={addToCart} onDec={decFromCart} onRemove={removeFromCart}
              inputCls={inputCls} compact
            />
          </div>
        </div>
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="fixed bottom-24 left-1/2 z-[105] -translate-x-1/2 rounded-full border border-[#007A4D]/30 bg-white px-5 py-2.5 text-xs font-medium text-[#007A4D] shadow-lg">
          <Check size={12} className="inline mr-1.5" />{successMsg}
        </div>
      )}
    </div>
  );
}

function CartPanel({
  cart, subtotal, total, totalHpp, laba, margin, diskon, setDiskon,
  metodeBayar, setMetodeBayar, bayar, setBayar, kembali,
  loading, onProses, onReset, onHold, onAdd, onDec, onRemove, inputCls, compact,
}: {
  cart: CartItem[]; subtotal: number; total: number; totalHpp: number;
  laba: number; margin: number; diskon: string; setDiskon: (v: string) => void;
  metodeBayar: string; setMetodeBayar: (v: string) => void;
  bayar: string; setBayar: (v: string) => void; kembali: number;
  loading: boolean; onProses: () => void; onReset: () => void; onHold: () => void;
  onAdd: (p: Product) => void; onDec: (id: string) => void; onRemove: (id: string) => void;
  inputCls: string; compact?: boolean;
}) {
  const pad = compact ? "" : "px-4 py-3";

  return (
    <div>
      {/* Items */}
      <div className={pad + (compact ? "" : " border-b border-[#E3EBE6]")}>
        {cart.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#8A9A90]">Pilih produk dulu</p>
        ) : (
          <div className="flex flex-col gap-2 mb-3">
            {cart.map(c => (
              <div key={c.product.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 min-w-0 truncate text-[#5C6B63]">{c.product.name}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => onDec(c.product.id)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center border border-[#C5D4CB] text-[#5C6B63]">
                    <Minus size={10} />
                  </button>
                  <span className="w-5 text-center font-mono text-[#0F1F17]">{c.qty}</span>
                  <button type="button" onClick={() => onAdd(c.product)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center border border-[#007A4D]/40 text-[#007A4D] bg-[#007A4D]/10">
                    <Plus size={10} />
                  </button>
                </div>
                <span className="font-mono text-[#3D4F45] w-20 text-right">{fmtRp((c.product.price || 0) * c.qty)}</span>
                <button type="button" onClick={() => onRemove(c.product.id)} className="text-[#5C6B63] hover:text-[#B42318]">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="h-px bg-[#E3EBE6] mb-2" />
        <div className="flex justify-between text-xs mb-1"><span className="text-[#5C6B63]">Subtotal</span><span className="font-mono text-[#3D4F45]">{fmtRp(subtotal)}</span></div>
        <div className="flex justify-between items-center text-xs mb-2">
          <span className="text-[#5C6B63]">Diskon</span>
          <input type="number" placeholder="0" value={diskon} onChange={e => setDiskon(e.target.value)}
            className="w-24 text-right text-xs px-2 py-1 rounded-lg border border-[#C5D4CB] bg-white text-[#0F1F17] focus:outline-none font-mono" />
        </div>
        <div className="h-px bg-[#E3EBE6] mb-2" />
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-sm font-medium text-[#0F1F17]">Total</span>
          <span className="text-base font-semibold text-[#007A4D]" style={{ fontFamily: "ui-monospace, monospace" }}>{fmtRp(total)}</span>
        </div>
        <p className="text-[10px] text-[#5C6B63]">Laba <span className="text-[#007A4D]">{fmtRp(laba)}</span> · margin {margin}%</p>
      </div>

      {/* Metode bayar */}
      <div className={compact ? "pt-3" : "px-4 py-3 border-b border-[#E3EBE6]"}>
        <p className="text-[10px] text-[#5C6B63] uppercase tracking-widest mb-2">Metode Bayar</p>
        <div className="grid grid-cols-4 gap-1.5">
          {METODE_BAYAR.map(m => (
            <button key={m.val} type="button" onClick={() => setMetodeBayar(m.val)}
              className="py-2 rounded-lg border text-center text-[11px] font-medium"
              style={metodeBayar === m.val
                ? { borderColor: "rgba(0,122,77,.45)", color: "#007A4D", background: "rgba(0,122,77,.08)" }
                : { borderColor: "#C5D4CB", color: "#5C6B63" }}>
              {m.lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Tunai input */}
      {metodeBayar === "tunai" && cart.length > 0 && (
        <div className={compact ? "pt-3" : "px-4 py-3 border-b border-[#E3EBE6]"}>
          <p className="text-[10px] text-[#5C6B63] uppercase tracking-widest mb-2">Bayar Tunai (Rp)</p>
          <div className="mb-2 grid grid-cols-4 gap-1.5">
            {[
              { lbl: "Uang pas", val: total },
              { lbl: "20rb", val: 20000 },
              { lbl: "50rb", val: 50000 },
              { lbl: "100rb", val: 100000 },
            ].map((q) => {
              const active = Number(bayar) === q.val;
              const disabled = q.val < total && q.lbl !== "Uang pas";
              return (
                <button
                  key={q.lbl}
                  type="button"
                  disabled={disabled}
                  onClick={() => setBayar(String(q.val))}
                  className="rounded-lg border py-2 text-[10px] font-semibold disabled:opacity-30"
                  style={active
                    ? { borderColor: "rgba(0,122,77,.5)", color: "#007A4D", background: "rgba(0,122,77,.1)" }
                    : { borderColor: "#C5D4CB", color: "#5C6B63", background: "#fff" }}
                >
                  {q.lbl}
                </button>
              );
            })}
          </div>
          <input type="number" placeholder={String(Math.ceil(total / 1000) * 1000)}
            value={bayar} onChange={e => setBayar(e.target.value)} className={inputCls + " font-mono"} />
          {kembali > 0 && (
            <p className="mt-1.5 text-xs text-[#007A4D]">Kembali <span className="font-mono font-semibold">{fmtRp(kembali)}</span></p>
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
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onHold} disabled={cart.length === 0}
            className="w-full py-2 rounded-xl text-xs border font-medium inline-flex items-center justify-center gap-1 disabled:opacity-40"
            style={{ borderColor: "rgba(0,122,77,.35)", color: "#007A4D", background: "rgba(0,122,77,.06)" }}>
            <Pause size={12} /> Parkir order
          </button>
          <button type="button" onClick={onReset}
            className="w-full py-2 rounded-xl text-xs border font-medium"
            style={{ borderColor: "rgba(180,35,24,.25)", color: "#B42318", background: "rgba(180,35,24,.05)" }}>
            Batal order
          </button>
        </div>
      </div>
    </div>
  );
}
