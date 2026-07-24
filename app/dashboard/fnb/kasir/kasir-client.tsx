"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Minus, Search, Check, Trash2, X, UtensilsCrossed, Users, ChevronDown, ChevronUp } from "lucide-react";

import { calcHpp, fmtRp } from "../lib/calc";
import type { FnbMenu } from "../lib/calc";
import { validateCartStock, deductStockForSale } from "../lib/process-order";
import FnbHubNav from "../components/fnb-hub-nav";
import FnbKpiRow from "../components/fnb-kpi-row";
import FnbStockAlerts from "../components/fnb-stock-alerts";
import FnbEmptyState from "../components/fnb-empty-state";
import ReceiptPrintPreview from "../components/receipt-print-preview";
import KasirPrintSettingsButton from "../components/kasir-print-settings-sheet";
import KasirPrinterWizard from "../components/kasir-printer-wizard";
import KasirReprintBar from "../components/kasir-reprint-bar";
import { buildKasirReceiptHtml, shortOrderNo } from "../lib/receipt-thermal";
import { executeSilentPrint, planReceiptPrint } from "../lib/trigger-receipt-print";
import { getKasirPrintSettings } from "../lib/kasir-print-settings";
import { isPrinterSetupDone, saveLastReceipt } from "../lib/last-receipt-storage";
import { FNB_NAV_BOTTOM_OFFSET } from "../lib/mobile-layout";
import { KASIR } from "../lib/kasir-theme";
import KasirTablePicker from "../components/kasir-table-picker";
import { buildOrderCatatan } from "../lib/kasir-order-meta";
import { trackClientEvent } from "@/lib/admin/track-event";

type Product = { id: string; name: string; stock: number; min_stock: number; category?: string | null };
type Checkin = { id: string; tanggal: string; jam_masuk: string; jam_keluar: string | null };
type Employee = { id: string; nama: string; jabatan: string | null; checkins: Checkin[] };
type CartItem = { menu: FnbMenu; qty: number };

const KATEGORI_COLOR: Record<string, string> = { "Makanan": "#2DD4BF", "Minuman": "#38BDF8", "Snack": "#F59E0B", "Paket": "#8B5CF6", "Lainnya": "#8B8AA0" };
const KATEGORI_ICON: Record<string, string> = { "Makanan": "ti-bowl-chopsticks", "Minuman": "ti-glass", "Snack": "ti-cookie", "Paket": "ti-package", "Lainnya": "ti-dots" };
const BTN_GRAD = { background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" } as const;

type OrderPanelProps = {
  cart: CartItem[];
  subtotal: number;
  totalHpp: number;
  diskon: string;
  setDiskon: (v: string) => void;
  metodeBayar: string;
  setMetodeBayar: (v: string) => void;
  bayar: string;
  setBayar: (v: string) => void;
  meja: string;
  setMeja: (v: string) => void;
  catatan: string;
  setCatatan: (v: string) => void;
  total: number;
  laba: number;
  margin: number;
  loading: boolean;
  onProses: () => void;
  onReset: () => void;
  onRemoveItem: (menuId: string) => void;
  onAddItem: (menu: FnbMenu) => void;
  onDecItem: (menuId: string) => void;
  compact?: boolean;
};

function OrderPanel({
  cart, subtotal, totalHpp, diskon, setDiskon, metodeBayar, setMetodeBayar,
  bayar, setBayar, meja, setMeja, catatan, setCatatan, total, laba, margin, loading, onProses, onReset,
  onRemoveItem, onAddItem, onDecItem, compact,
}: OrderPanelProps) {
  const bayarNum = Number(bayar) || 0;
  const kembali = metodeBayar === "tunai" && bayarNum > total ? bayarNum - total : 0;
  return (
    <>
      <div className={compact ? "px-0 py-0" : "px-4 py-3 border-b border-white/[0.06]"}>
        {!compact && <p className="text-[10px] font-medium text-[#2DD4BF] tracking-widest uppercase mb-3">Order aktif</p>}
        {cart.length === 0 ? (
          <p className="text-xs text-[#3A3B52] text-center py-4">Pilih menu dulu ya</p>
        ) : (
          <div className="flex flex-col gap-1.5 mb-3">
            {cart.map(c => (
              <div key={c.menu.id} className="flex items-center justify-between text-xs gap-2">
                <span className="text-[#8B8AA0] flex-1 min-w-0 truncate">{c.menu.nama}</span>
                {compact && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => onDecItem(c.menu.id)} className="w-6 h-6 rounded-lg flex items-center justify-center border border-white/[0.08] text-[#8B8AA0]"><Minus size={10} /></button>
                    <span className="w-4 text-center font-mono">{c.qty}</span>
                    <button onClick={() => onAddItem(c.menu)} className="w-6 h-6 rounded-lg flex items-center justify-center border border-[#2DD4BF]/40 text-[#2DD4BF] bg-[#2DD4BF]/08"><Plus size={10} /></button>
                  </div>
                )}
                <span style={{ fontFamily: "monospace", color: "#C4C3D4" }}>Rp{(c.menu.harga_jual * c.qty).toLocaleString("id-ID")}</span>
                {!compact && (
                  <button onClick={() => onRemoveItem(c.menu.id)} className="ml-1 text-[#5A5B7A] hover:text-[#EC4899]"><Trash2 size={11} /></button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="h-px bg-white/[0.06] mb-2"></div>
        <div className="flex justify-between text-xs mb-1.5"><span className="text-[#5A5B7A]">Subtotal</span><span style={{ fontFamily: "monospace", color: "#C4C3D4" }}>Rp{subtotal.toLocaleString("id-ID")}</span></div>
        <div className="flex justify-between items-center text-xs mb-2">
          <span className="text-[#5A5B7A]">Diskon</span>
          <div className="flex items-center gap-1">
            <input type="number" placeholder="0" value={diskon} onChange={e => setDiskon(e.target.value)}
              className="w-20 text-right text-xs px-2 py-1 rounded-lg border border-white/[0.08] bg-[#0A0A12] text-[#F0EFF8] focus:outline-none" style={{ fontFamily: "monospace" }} />
            <span className="text-[10px] text-[#5A5B7A]">Rp</span>
          </div>
        </div>
        <div className="h-px bg-white/[0.06] mb-2"></div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-sm font-medium text-[#F0EFF8]">Total</span>
          <span className="text-base font-semibold" style={{ color: "#2DD4BF", fontFamily: "JetBrains Mono, monospace" }}>Rp{total.toLocaleString("id-ID")}</span>
        </div>
        <p className="text-[10px] text-[#5A5B7A]">Laba <span style={{ color: "#2DD4BF" }}>Rp{Math.round(laba).toLocaleString("id-ID")}</span> · margin {margin}%</p>
      </div>

      <div className={compact ? "pt-3" : "px-4 py-3 border-b border-white/[0.06]"}>
        <p className="text-[10px] text-[#5A5B7A] tracking-widest uppercase mb-2">Metode bayar</p>
        <div className="grid grid-cols-3 gap-2">
          {[{ val: "tunai", lbl: "Tunai", icon: "ti-cash" }, { val: "qris", lbl: "QRIS", icon: "ti-qrcode" }, { val: "transfer", lbl: "Transfer", icon: "ti-credit-card" }].map(m => (
            <button key={m.val} onClick={() => setMetodeBayar(m.val)}
              className="py-2 rounded-lg border text-center text-xs font-medium"
              style={metodeBayar === m.val ? { borderColor: "rgba(45,212,191,.45)", color: "#2DD4BF", background: "rgba(45,212,191,.08)" } : { borderColor: "rgba(255,255,255,.08)", color: "#5A5B7A" }}>
              <i className={"ti " + m.icon} style={{ fontSize: "14px", display: "block", marginBottom: "2px" }} aria-hidden="true"></i>
              {m.lbl}
            </button>
          ))}
        </div>
      </div>

      {metodeBayar === "tunai" && cart.length > 0 && (
        <div className={compact ? "pt-3" : "px-4 py-3 border-b border-white/[0.06]"}>
          <p className="text-[10px] text-[#5A5B7A] tracking-widest uppercase mb-2">Bayar tunai</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder={String(Math.ceil(total / 1000) * 1000) || "0"}
              value={bayar}
              onChange={e => setBayar(e.target.value)}
              className="flex-1 text-sm px-3 py-2.5 rounded-lg border border-white/[0.08] bg-[#0A0A12] text-[#F0EFF8] focus:outline-none font-mono"
            />
            <span className="text-[10px] text-[#5A5B7A]">Rp</span>
          </div>
          {kembali > 0 && (
            <p className="mt-1.5 text-xs text-[#2DD4BF]">Kembali <span className="font-mono font-semibold">Rp{kembali.toLocaleString("id-ID")}</span></p>
          )}
        </div>
      )}

      <div className={compact ? "pt-3" : "px-4 py-3 border-b border-white/[0.06]"}>
        <KasirTablePicker meja={meja} onChange={setMeja} compact={compact} />
        <input type="text" placeholder="Catatan tambahan (extra pedas...)" value={catatan} onChange={e => setCatatan(e.target.value)}
          className="w-full text-xs px-3 py-2 rounded-lg border border-white/[0.08] bg-[#0A0A12] text-[#F0EFF8] placeholder:text-[#3A3B52] focus:outline-none" />
      </div>

      <div className={compact ? "pt-4 flex flex-col gap-2" : "px-4 py-4 flex flex-col gap-2"}>
        <button onClick={onProses} disabled={loading || cart.length === 0}
          className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          style={BTN_GRAD}>
          <Check size={15} />
          {loading ? "Memproses..." : "Proses — Rp" + total.toLocaleString("id-ID")}
        </button>
        <button onClick={onReset}
          className="w-full py-2 rounded-xl text-xs border font-medium"
          style={{ borderColor: "rgba(236,72,153,.25)", color: "#EC4899", background: "rgba(236,72,153,.05)" }}>
          Batal order
        </button>
      </div>
    </>
  );
}

export default function KasirClient({ menus, products, employees, userId, businessId, businessName, omzetHariIni, labaHariIni, totalOrder, today }: {
  menus: FnbMenu[]; products: Product[]; employees: Employee[]; userId: string; businessId: string; businessName: string;
  omzetHariIni: number; labaHariIni: number; totalOrder: number; today: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Semua");
  const [diskon, setDiskon] = useState("");
  const [metodeBayar, setMetodeBayar] = useState("tunai");
  const [meja, setMeja] = useState("");
  const [catatan, setCatatan] = useState("");
  const [bayar, setBayar] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<{
    html: string; autoPrint: boolean; autoClose: boolean; widthMm: number;
  } | null>(null);
  const [printToast, setPrintToast] = useState<string | null>(null);
  const [showPrinterWizard, setShowPrinterWizard] = useState(false);
  const [receiptVersion, setReceiptVersion] = useState(0);

  useEffect(() => {
    if (!isPrinterSetupDone()) setShowPrinterWizard(true);
  }, []);

  const todayCheckins = employees.map(e => ({
    ...e,
    checkedIn: e.checkins.some(c => c.tanggal === today && !c.jam_keluar),
    checkinTime: e.checkins.find(c => c.tanggal === today)?.jam_masuk || null,
  }));

  const filtered = useMemo(() => {
    return menus.filter(m =>
      m.nama.toLowerCase().includes(search.toLowerCase()) &&
      (activeTab === "Semua" || m.kategori === activeTab)
    );
  }, [menus, search, activeTab]);

  const categories = ["Semua", ...Array.from(new Set(menus.map(m => m.kategori || "Lainnya")))];

  const addToCart = (menu: FnbMenu) => {
    setCart(prev => {
      const existing = prev.find(c => c.menu.id === menu.id);
      if (existing) return prev.map(c => c.menu.id === menu.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { menu, qty: 1 }];
    });
  };

  const removeFromCart = (menuId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.menu.id === menuId);
      if (!existing) return prev;
      if (existing.qty <= 1) return prev.filter(c => c.menu.id !== menuId);
      return prev.map(c => c.menu.id === menuId ? { ...c, qty: c.qty - 1 } : c);
    });
  };

  const getQty = (menuId: string) => cart.find(c => c.menu.id === menuId)?.qty || 0;
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  const subtotal = cart.reduce((s, c) => s + c.menu.harga_jual * c.qty, 0);
  const totalHpp = cart.reduce((s, c) => s + calcHpp(c.menu) * c.qty, 0);
  const diskonNum = Number(diskon) || 0;
  const total = Math.max(0, subtotal - diskonNum);
  const laba = total - totalHpp;
  const margin = total > 0 ? Math.round(laba / total * 100) : 0;
  const dayMargin = omzetHariIni > 0 ? Math.round(labaHariIni / omzetHariIni * 100) : 0;

  const resetOrder = () => { setCart([]); setDiskon(""); setBayar(""); setMeja(""); setCatatan(""); setMetodeBayar("tunai"); setCartOpen(false); };

  const triggerReceiptPrint = (html: string) => {
    const plan = planReceiptPrint();
    if (plan.mode === "silent") {
      executeSilentPrint(html);
      setPrintToast("Struk dicetak — lanjut order berikutnya");
      setTimeout(() => setPrintToast(null), 2800);
      return;
    }
    setReceiptPreview({
      html,
      autoPrint: plan.mode === "preview" ? plan.autoPrint : false,
      autoClose: plan.mode === "preview" ? plan.autoClose : false,
      widthMm: plan.widthMm,
    });
  };

  const handleCheckin = async (emp: Employee) => {
    setCheckinLoading(emp.id);
    const isIn = todayCheckins.find(e => e.id === emp.id)?.checkedIn;
    if (isIn) {
      const checkin = emp.checkins.find(c => c.tanggal === today && !c.jam_keluar);
      if (checkin) {
        await supabase.from("checkins").update({ jam_keluar: new Date().toTimeString().slice(0, 5) }).eq("id", checkin.id);
      }
    } else {
      await supabase.from("checkins").insert({ employee_id: emp.id, business_id: businessId, tanggal: today, jam_masuk: new Date().toTimeString().slice(0, 5) });
    }
    setCheckinLoading("");
    router.refresh();
  };

  const handleProses = async () => {
    if (cart.length === 0) return;

    const stockCheck = validateCartStock(cart);
    if (!stockCheck.ok) {
      alert(stockCheck.message);
      return;
    }

    setLoading(true);
    const orderCatatan = buildOrderCatatan(meja, catatan);

    const { data: order, error } = await supabase.from("orders").insert({
      user_id: userId, business_id: businessId,
      total, diskon: diskonNum, hpp: totalHpp, laba,
      metode_bayar: metodeBayar, catatan: orderCatatan,
      order_date: today,
    }).select("id").single();

    if (error || !order) { alert("Gagal simpan order: " + error?.message); setLoading(false); return; }

    const items = cart.map(c => ({
      order_id: order.id, menu_id: c.menu.id, qty: c.qty,
      harga_jual: c.menu.harga_jual, hpp: calcHpp(c.menu), laba: (c.menu.harga_jual - calcHpp(c.menu)) * c.qty,
    }));
    const { error: itemsErr } = await supabase.from("order_items").insert(items);
    if (itemsErr) { alert("Order tersimpan tapi item gagal: " + itemsErr.message); setLoading(false); return; }

    const stockResult = await deductStockForSale(supabase, cart, userId, { today, notePrefix: "Kasir" });
    if (!stockResult.ok) {
      alert("Stok sebagian gagal dipotong: " + stockResult.errors.join(", "));
    }

    const { error: txErr } = await supabase.from("transactions").insert({
      user_id: userId, business_id: businessId,
      type: "pemasukan", scope: "bisnis",
      category: "Penjualan F&B",
      description: cart.map(c => c.menu.nama + " x" + c.qty).join(", "),
      amount: total, transaction_date: today,
    });
    if (txErr) { alert("Order tersimpan tapi keuangan gagal: " + txErr.message); }

    const bayarNum = Number(bayar) || 0;
    const kembali = metodeBayar === "tunai" && bayarNum > total ? bayarNum - total : 0;
    const widthMm = getKasirPrintSettings().paperWidthMm;
    const activeKasir = todayCheckins.find(e => e.checkedIn)?.nama;
    const receipt = buildKasirReceiptHtml({
      businessName: businessName || "Warung",
      orderNo: shortOrderNo(order.id),
      kasirName: activeKasir || "Kasir",
      items: cart.map(c => ({ nama: c.menu.nama, qty: c.qty, harga: c.menu.harga_jual })),
      subtotal,
      diskon: diskonNum,
      total,
      metodeBayar,
      catatan: orderCatatan,
      bayar: metodeBayar === "tunai" && bayarNum > 0 ? bayarNum : undefined,
      kembali: kembali > 0 ? kembali : undefined,
    }, widthMm);

    saveLastReceipt({ html: receipt, orderNo: shortOrderNo(order.id), total, savedAt: new Date().toISOString() });
    setReceiptVersion(v => v + 1);
    triggerReceiptPrint(receipt);
    trackClientEvent({
      event: "fnb_kasir_sale",
      module: "fnb",
      business_id: businessId,
      meta: { total, items: cart.length, metode: metodeBayar },
    });
    resetOrder();
    setLoading(false);
    router.refresh();
  };

  const orderPanelProps: OrderPanelProps = {
    cart, subtotal, totalHpp, diskon, setDiskon, metodeBayar, setMetodeBayar,
    bayar, setBayar, meja, setMeja, catatan, setCatatan, total, laba, margin, loading,
    onProses: handleProses, onReset: resetOrder,
    onRemoveItem: (id) => setCart(prev => prev.filter(x => x.menu.id !== id)),
    onAddItem: addToCart, onDecItem: removeFromCart,
  };

  return (
    <div
      className="relative w-full min-w-0 max-w-full max-md:-mx-3 max-md:px-3 max-md:pb-[calc(56px+env(safe-area-inset-bottom))] max-md:pt-1 lg:pb-0"
      style={{ background: KASIR.bg.mesh }}
    >
      <FnbHubNav />
      <FnbKpiRow variant="vivid" items={[
        { label: "Omzet hari ini", value: fmtRp(omzetHariIni), color: "#2DD4BF" },
        { label: "Total order", value: String(totalOrder), color: "#8B5CF6" },
        { label: "Laba hari ini", value: fmtRp(labaHariIni), color: "#F59E0B" },
        { label: "Margin", value: omzetHariIni > 0 ? dayMargin + "%" : "—", color: "#38BDF8" },
      ]} />

      <div className="mb-3 hidden md:block">
        <FnbStockAlerts products={products.map(p => ({ ...p, min_stock: p.min_stock ?? 5 }))} />
      </div>

      <div className="mb-4 overflow-hidden rounded-2xl border border-[#2DD4BF]/25 bg-[#13131F]/95 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md lg:mb-6">
        <div className="h-[2px] shrink-0" style={{ background: KASIR.gradient.headerLine }} />
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-3 py-2 md:px-4">
          <button
            type="button"
            onClick={() => setShiftOpen(v => !v)}
            className="flex min-w-0 flex-1 items-center justify-between md:cursor-default"
          >
            <p className="text-[10px] font-medium uppercase tracking-widest text-[#2DD4BF]">Shift karyawan — {today}</p>
            <span className="text-[#8B8AA0] md:hidden">{shiftOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
          </button>
          <div className="flex items-center gap-2">
            <KasirReprintBar refreshKey={receiptVersion} />
            <KasirPrintSettingsButton />
          </div>
        </div>
        <div className={`border-t border-white/[0.06] px-3 pb-3 md:block md:border-0 md:px-4 md:pb-4 ${shiftOpen ? "block" : "hidden md:block"}`}>
        {employees.length === 0 ? (
          <FnbEmptyState
            icon={Users}
            title="Belum ada tim kasir"
            subtitle="Tambah karyawan dulu biar bisa catat shift masuk/pulang."
            actionLabel="Kelola Tim"
            actionHref="/dashboard/karyawan-toko"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {todayCheckins.map(emp => (
              <div key={emp.id} className="flex items-center gap-3 bg-[#0A0A12] rounded-xl px-3 py-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0" style={{ background: emp.checkedIn ? "rgba(45,212,191,.12)" : "rgba(255,255,255,.04)", color: emp.checkedIn ? "#2DD4BF" : "#5A5B7A" }}>
                  {emp.nama.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#F0EFF8]">{emp.nama}</p>
                  <p className="text-[10px] text-[#5A5B7A]">
                    {emp.jabatan || "Karyawan"}
                    {emp.checkinTime && <span style={{ color: "#8B8AA0", fontFamily: "monospace" }}> · masuk {emp.checkinTime}</span>}
                  </p>
                </div>
                <div className="w-2 h-2 rounded-full" style={{ background: emp.checkedIn ? "#2DD4BF" : "#F59E0B" }}></div>
                <button
                  onClick={() => handleCheckin(emp)}
                  disabled={checkinLoading === emp.id}
                  className="text-xs px-3 py-1.5 rounded-lg border font-medium"
                  style={emp.checkedIn
                    ? { borderColor: "rgba(236,72,153,.3)", color: "#EC4899", background: "rgba(236,72,153,.06)" }
                    : { borderColor: "rgba(45,212,191,.3)", color: "#2DD4BF", background: "rgba(45,212,191,.06)" }
                  }
                >
                  {checkinLoading === emp.id ? "..." : emp.checkedIn ? "Pulang" : "Masuk shift"}
                </button>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px] lg:gap-6">
        <div className="overflow-hidden rounded-2xl border border-[#2DD4BF]/25 bg-[#13131F]/95 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md">
          <div className="h-[2px] shrink-0 md:hidden" style={{ background: KASIR.gradient.headerLine }} />
          <div className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#13131F]/95 backdrop-blur-md lg:static lg:bg-transparent">
            <div className="mx-3 mt-2.5 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0A0A14]/80 px-3 py-2.5 md:mx-4 md:mt-3 md:rounded-none md:border-0 md:bg-transparent md:px-4 md:py-3">
              <Search size={14} className="flex-shrink-0 text-[#2DD4BF]" />
              <input type="text" placeholder="Cari menu..." value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-[#FAFAFE] placeholder:text-[#5E5D78] focus:outline-none" />
            </div>
            <div className="flex gap-2 overflow-x-auto px-3 py-2.5 scrollbar-none md:px-4 md:py-2.5">
            {categories.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={"text-[11px] px-3.5 py-1.5 rounded-full border whitespace-nowrap font-medium transition-colors " + (activeTab === tab ? "border-[#2DD4BF]/50 text-[#2DD4BF] bg-[#2DD4BF]/15" : "border-white/[0.08] text-[#5E5D78] bg-white/[0.03]")}>
                {tab}
              </button>
            ))}
          </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4">
            {filtered.length === 0 ? (
              <div className="col-span-full">
                <FnbEmptyState
                  icon={UtensilsCrossed}
                  title="Belum ada menu aktif"
                  subtitle="Buat menu dulu di Master Menu, pastikan statusnya aktif."
                  actionLabel="Buat Menu"
                  actionHref="/dashboard/master-menu"
                />
              </div>
            ) : filtered.map(m => {
              const hpp = calcHpp(m);
              const itemMargin = m.harga_jual > 0 ? Math.round((m.harga_jual - hpp) / m.harga_jual * 100) : 0;
              const qty = getQty(m.id);
              const kat = m.kategori || "Lainnya";
              const color = KATEGORI_COLOR[kat] || "#8B8AA0";
              const icon = KATEGORI_ICON[kat] || "ti-dots";
              return (
                <div key={m.id} className="cursor-pointer overflow-hidden rounded-2xl border bg-[#13131F] active:scale-[0.98] transition-shadow"
                  style={{
                    borderColor: qty > 0 ? "rgba(45,212,191,.45)" : "rgba(255,255,255,0.08)",
                    boxShadow: qty > 0 ? "0 0 0 1px rgba(45,212,191,.35), 0 12px 32px rgba(45,212,191,.12)" : "0 8px 24px rgba(0,0,0,.3)",
                  }}
                  onClick={() => addToCart(m)}>
                  {m.foto_url ? (
                    <div className="h-20 overflow-hidden sm:h-24">
                      <img src={m.foto_url} alt={m.nama} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-5 sm:py-6" style={{ background: `linear-gradient(160deg, ${color}30, ${color}08)` }}>
                      <i className={"ti " + icon} style={{ fontSize: "34px", color, filter: `drop-shadow(0 2px 10px ${color}66)` }} aria-hidden="true"></i>
                    </div>
                  )}
                  <div className="p-2.5 sm:p-3">
                    <span className="mb-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] sm:text-[10px]" style={{ background: color + "15", color }}>{kat}</span>
                    <p className="mb-1 truncate text-sm font-medium text-[#F0EFF8]">{m.nama}</p>
                    <p className="mb-2 text-[9px] text-[#5A5B7A] sm:text-[10px]">HPP {fmtRp(Math.round(hpp))}</p>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold sm:text-sm" style={{ color: "#2DD4BF", fontFamily: "JetBrains Mono, monospace" }}>Rp{m.harga_jual.toLocaleString("id-ID")}</p>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => removeFromCart(m.id)} className="flex h-8 w-8 items-center justify-center rounded-lg border sm:h-6 sm:w-6"
                          style={qty > 0 ? { borderColor: "rgba(45,212,191,.4)", color: "#2DD4BF", background: "rgba(45,212,191,.08)" } : { borderColor: "rgba(255,255,255,.08)", color: "#5A5B7A" }}>
                          <Minus size={12} />
                        </button>
                        <span className="w-5 text-center text-xs font-medium sm:w-4" style={{ color: qty > 0 ? "#2DD4BF" : "#3A3B52", fontFamily: "monospace" }}>{qty}</span>
                        <button onClick={() => addToCart(m)} className="flex h-8 w-8 items-center justify-center rounded-lg border sm:h-6 sm:w-6"
                          style={{ borderColor: "rgba(45,212,191,.4)", color: "#2DD4BF", background: "rgba(45,212,191,.08)" }}>
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="hidden lg:block bg-[#0F0F1A] border border-white/[0.06] rounded-2xl overflow-hidden h-fit">
          <OrderPanel {...orderPanelProps} />
        </div>
      </div>

      {/* Mobile sticky cart bar */}
      {cart.length > 0 && !cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="lg:hidden fixed left-4 right-4 z-[45] flex items-center justify-between rounded-2xl px-4 py-3.5 active:scale-[0.98]"
          style={{ ...BTN_GRAD, bottom: FNB_NAV_BOTTOM_OFFSET, boxShadow: KASIR.shadow.fab }}
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#050508]/25 text-xs font-bold">{cartCount}</span>
            Lihat order
          </span>
          <span className="font-mono text-sm font-bold">Rp{total.toLocaleString("id-ID")}</span>
        </button>
      )}

      {/* Mobile cart bottom sheet */}
      {cartOpen && (
        <div className="fixed inset-0 z-[80] flex items-end bg-[#050508]/80 backdrop-blur-sm lg:hidden" onClick={() => setCartOpen(false)}>
          <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl border border-[#2DD4BF]/30 border-b-0 bg-[#1A1A28] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-16px_48px_rgba(0,0,0,.55)]" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-[3px] w-12 rounded-full" style={{ background: KASIR.gradient.headerLine }} />
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/20" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#2DD4BF]">Order aktif</p>
                <p className="text-xs text-[#5A5B7A]">{cart.length} item</p>
              </div>
              <button type="button" onClick={() => setCartOpen(false)} className="rounded-full bg-white/5 p-2 text-[#8B8AA0]"><X size={16} /></button>
            </div>
            <OrderPanel {...orderPanelProps} compact />
          </div>
        </div>
      )}

      {/* Struk thermal setelah transaksi */}
      {printToast && (
        <div className="fixed bottom-24 left-1/2 z-[105] -translate-x-1/2 rounded-full border border-[#2DD4BF]/30 bg-[#0D0D1A] px-4 py-2.5 text-xs font-medium text-[#2DD4BF] shadow-lg max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]">
          {printToast}
        </div>
      )}

      {receiptPreview && (
        <ReceiptPrintPreview
          html={receiptPreview.html}
          title="Transaksi berhasil!"
          widthMm={receiptPreview.widthMm}
          autoPrint={receiptPreview.autoPrint}
          autoCloseOnPrint={receiptPreview.autoClose}
          onClose={() => setReceiptPreview(null)}
        />
      )}

      {showPrinterWizard && (
        <KasirPrinterWizard
          businessName={businessName || "Warung"}
          kasirName={todayCheckins.find(e => e.checkedIn)?.nama}
          onDone={() => setShowPrinterWizard(false)}
        />
      )}
    </div>
  );
}
