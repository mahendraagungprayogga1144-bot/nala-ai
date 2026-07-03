"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

import { calcHpp } from "@/app/dashboard/fnb/lib/calc";
import type { FnbMenu } from "@/app/dashboard/fnb/lib/calc";
import { validateCartStock, deductStockForSale } from "@/app/dashboard/fnb/lib/process-order";
import { buildKasirReceiptHtml, shortOrderNo } from "@/app/dashboard/fnb/lib/receipt-thermal";
import ReceiptPrintPreview from "@/app/dashboard/fnb/components/receipt-print-preview";
import KasirPrintSettingsButton from "@/app/dashboard/fnb/components/kasir-print-settings-sheet";
import KasirPrinterWizard from "@/app/dashboard/fnb/components/kasir-printer-wizard";
import KasirReprintBar from "@/app/dashboard/fnb/components/kasir-reprint-bar";
import { executeSilentPrint, planReceiptPrint } from "@/app/dashboard/fnb/lib/trigger-receipt-print";
import { getKasirPrintSettings } from "@/app/dashboard/fnb/lib/kasir-print-settings";
import { isPrinterSetupDone, saveLastReceipt } from "@/app/dashboard/fnb/lib/last-receipt-storage";

type Menu = FnbMenu;
type Employee = { id: string; nama: string; jabatan: string | null; kasir_token: string; webauthn_credential_id: string | null };
type Business = { id: string; name: string; type: string };
type Stats = { omzet: number; laba: number; totalOrders: number; foodCost: number };

const KATEGORI_COLOR: Record<string, string> = { "Makanan": "#2DD4BF", "Minuman": "#38BDF8", "Snack": "#F59E0B", "Paket": "#8B5CF6", "Lainnya": "#8B8AA0" };
const KATEGORI_ICON: Record<string, string> = { "Makanan": "ti-bowl-chopsticks", "Minuman": "ti-glass", "Snack": "ti-cookie", "Paket": "ti-package", "Lainnya": "ti-dots" };

function buf2b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b642buf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

export default function KasirPublicClient({ employee: emp, business, menus, initialStats, today }: {
  employee: Employee; business: Business; menus: Menu[];
  initialStats: Stats; today: string;
}) {
  const supabase = createClient();
  const [employee, setEmployee] = useState(emp);
  const [screen, setScreen] = useState<"auth"|"scanning"|"welcome"|"kasir">("auth");
  const [authMode, setAuthMode] = useState<"register"|"login">(emp.webauthn_credential_id ? "login" : "register");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Semua");
  const [diskon, setDiskon] = useState("");
  const [metodeBayar, setMetodeBayar] = useState("tunai");
  const [catatan, setCatatan] = useState("");
  const [bayar, setBayar] = useState("");
  const [loading, setLoading] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<{
    html: string; autoPrint: boolean; autoClose: boolean; widthMm: number;
  } | null>(null);
  const [printToast, setPrintToast] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showSOP, setShowSOP] = useState(false);
  const [stats, setStats] = useState(initialStats);
  const [clock, setClock] = useState("");
  const [checkinId, setCheckinId] = useState<string|null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [fpStatus, setFpStatus] = useState("");
  const [showPrinterWizard, setShowPrinterWizard] = useState(false);
  const [receiptVersion, setReceiptVersion] = useState(0);

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (screen === "kasir" && !isPrinterSetupDone()) setShowPrinterWizard(true);
  }, [screen]);

  // ===== WEBAUTHN REGISTER =====
  const doRegister = async () => {
    if (!window.PublicKeyCredential) {
      setFpStatus("Browser tidak support WebAuthn. Coba Safari atau Chrome terbaru.");
      return;
    }
    setScreen("scanning");
    setFpStatus("Mendaftarkan sidik jari...");
    try {
      const userId = new TextEncoder().encode(employee.id);
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "GercepAI Kasir", id: location.hostname },
          user: {
            id: userId,
            name: employee.kasir_token,
            displayName: employee.nama,
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "preferred",
          },
          timeout: 60000,
        }
      }) as PublicKeyCredential | null;

      if (!credential) throw new Error("Credential null");

      const credId = buf2b64(credential.rawId);
      
      // Simpan credential ID ke database
      const { error } = await supabase
        .from("employees")
        .update({ webauthn_credential_id: credId })
        .eq("id", employee.id);

      if (error) throw error;

      setEmployee(prev => ({ ...prev, webauthn_credential_id: credId }));
      await doCheckin();
    } catch (e: unknown) {
      console.error("Register error:", e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("cancel") || msg.includes("abort") || msg.includes("NotAllowedError")) {
        setFpStatus("Dibatalkan. Coba lagi.");
      } else {
        setFpStatus("Gagal daftar sidik jari: " + msg);
      }
      setScreen("auth");
    }
  };

  // ===== WEBAUTHN LOGIN =====
  const doLogin = async () => {
    if (!window.PublicKeyCredential) {
      setFpStatus("Browser tidak support WebAuthn.");
      return;
    }
    setScreen("scanning");
    setFpStatus("Verifikasi sidik jari...");
    try {
      const allowCreds = employee.webauthn_credential_id ? [{
        id: b642buf(employee.webauthn_credential_id),
        type: "public-key" as const,
      }] : [];

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          userVerification: "required",
          timeout: 60000,
          allowCredentials: allowCreds,
        }
      }) as PublicKeyCredential | null;

      if (!assertion) throw new Error("Assertion null");
      await doCheckin();
    } catch (e: unknown) {
      console.error("Login error:", e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("cancel") || msg.includes("abort") || msg.includes("NotAllowedError")) {
        setFpStatus("Dibatalkan. Coba lagi.");
      } else {
        setFpStatus("Verifikasi gagal: " + msg);
      }
      setScreen("auth");
    }
  };

  const doCheckin = async () => {
    const jam = new Date().toTimeString().slice(0, 5);
    const { data } = await supabase.from("checkins").insert({
      employee_id: employee.id,
      business_id: business.id,
      tanggal: today,
      jam_masuk: jam,
    }).select("id").single();
    if (data) setCheckinId(data.id);
    setScreen("welcome");
  };

  const doCheckout = async () => {
    if (checkinId) {
      await supabase.from("checkins").update({ jam_keluar: new Date().toTimeString().slice(0, 5) }).eq("id", checkinId);
    }
    setShowCheckout(false);
    setScreen("auth");
    setCart({});
    setStats(initialStats);
  };

  const filtered = menus.filter(m =>
    m.nama.toLowerCase().includes(search.toLowerCase()) &&
    (activeTab === "Semua" || m.kategori === activeTab)
  );
  const categories = ["Semua", ...Array.from(new Set(menus.map(m => m.kategori || "Lainnya")))];
  const cartItems = Object.entries(cart).map(([id, qty]) => ({ menu: menus.find(m => m.id === id)!, qty })).filter(x => x.menu);
  const subtotal = cartItems.reduce((s, c) => s + c.menu.harga_jual * c.qty, 0);
  const totalHpp = cartItems.reduce((s, c) => s + calcHpp(c.menu) * c.qty, 0);
  const discNum = Number(diskon) || 0;
  const total = Math.max(0, subtotal - discNum);
  const laba = total - totalHpp;
  const margin = total > 0 ? Math.round(laba / total * 100) : 0;

  const addItem = (id: string) => setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  const removeItem = (id: string) => setCart(prev => {
    const next = { ...prev };
    if (next[id] > 1) next[id]--;
    else delete next[id];
    return next;
  });

  const triggerReceiptPrint = (html: string) => {
    const plan = planReceiptPrint();
    if (plan.mode === "silent") {
      executeSilentPrint(html);
      setPrintToast("Struk dicetak ✓");
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

  const handleProses = async () => {
    if (!cartItems.length) return;

    const stockCheck = validateCartStock(cartItems.map(c => ({ menu: c.menu, qty: c.qty })));
    if (!stockCheck.ok) {
      alert(stockCheck.message);
      return;
    }

    setLoading(true);
    const { data: order, error } = await supabase.from("orders").insert({
      user_id: employee.id,
      business_id: business.id,
      total, diskon: discNum, hpp: totalHpp, laba,
      metode_bayar: metodeBayar, catatan: catatan || null,
      order_date: today,
    }).select("id").single();

    if (error || !order) { alert("Gagal: " + error?.message); setLoading(false); return; }

    await supabase.from("order_items").insert(cartItems.map(c => ({
      order_id: order.id, menu_id: c.menu.id, qty: c.qty,
      harga_jual: c.menu.harga_jual, hpp: calcHpp(c.menu),
      laba: (c.menu.harga_jual - calcHpp(c.menu)) * c.qty,
    })));

    await deductStockForSale(
      supabase,
      cartItems.map(c => ({ menu: c.menu, qty: c.qty })),
      employee.id,
      { today, notePrefix: `Kasir ${employee.nama}` },
    );

    await supabase.from("transactions").insert({
      user_id: employee.id,
      business_id: business.id,
      type: "pemasukan", scope: "bisnis",
      category: "Penjualan F&B",
      description: cartItems.map(c => c.menu.nama + " x" + c.qty).join(", "),
      amount: total, transaction_date: today,
    });

    const bayarNum = Number(bayar) || 0;
    const kembali = metodeBayar === "tunai" && bayarNum > total ? bayarNum - total : 0;
    const widthMm = getKasirPrintSettings().paperWidthMm;
    const receipt = buildKasirReceiptHtml({
      businessName: business.name,
      orderNo: shortOrderNo(order.id),
      kasirName: employee.nama,
      items: cartItems.map(c => ({ nama: c.menu.nama, qty: c.qty, harga: c.menu.harga_jual })),
      subtotal,
      diskon: discNum,
      total,
      metodeBayar,
      catatan: catatan || null,
      bayar: metodeBayar === "tunai" && bayarNum > 0 ? bayarNum : undefined,
      kembali: kembali > 0 ? kembali : undefined,
    }, widthMm);

    saveLastReceipt({ html: receipt, orderNo: shortOrderNo(order.id), total, savedAt: new Date().toISOString() });
    setReceiptVersion(v => v + 1);
    setStats(prev => ({ ...prev, omzet: prev.omzet + total, laba: prev.laba + Math.round(laba), totalOrders: prev.totalOrders + 1 }));
    triggerReceiptPrint(receipt);
    setLoading(false);
    setCartOpen(false);
    setCart({}); setDiskon(""); setBayar(""); setCatatan("");
  };

  const S = { background: "#070711", color: "#F0EFF8", fontFamily: "'Space Grotesk', sans-serif", minHeight: "100vh" };
  const btnGrad: React.CSSProperties = { width: "100%", padding: "13px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "8px" };

  if (screen === "auth") return (
    <div style={{ ...S, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", background: "radial-gradient(ellipse at 50% 0%, rgba(45,212,191,.08) 0%, transparent 60%), #070711" }}>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap')`}</style>
      <div style={{ fontSize: "24px", fontWeight: 700, marginBottom: ".25rem" }}>GercepAI <span style={{ background: "linear-gradient(135deg,#2DD4BF,#8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Kasir</span></div>
      <div style={{ fontSize: "12px", color: "#5A5B7A", marginBottom: "2.5rem" }}>{business.name}</div>
      <div style={{ background: "#0D0D1A", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "2rem", width: "100%", maxWidth: "360px" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ position: "relative", width: "90px", height: "90px", margin: "0 auto 1rem" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid rgba(45,212,191,.3)", animation: "fpRing 2s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: "8px", borderRadius: "50%", border: "1px solid rgba(45,212,191,.15)", animation: "fpRing 2s ease-in-out infinite 0.3s" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", color: "#2DD4BF" }}>
              <i className="ti ti-fingerprint" />
            </div>
          </div>
          <style>{`@keyframes fpRing{0%,100%{transform:scale(1);opacity:.4;border-color:rgba(45,212,191,.3)}50%{transform:scale(1.05);opacity:1;border-color:rgba(45,212,191,.8)}}`}</style>
          <div style={{ fontSize: "17px", fontWeight: 600, marginBottom: ".25rem" }}>{employee.nama}</div>
          <div style={{ fontSize: "12px", color: "#5A5B7A", marginBottom: "1rem" }}>{employee.jabatan || "Kasir"} · {business.name}</div>
        </div>

        {authMode === "register" ? (
          <>
            <div style={{ background: "rgba(45,212,191,.06)", border: "0.5px solid rgba(45,212,191,.15)", borderRadius: "10px", padding: "10px 14px", marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "11px", color: "#5A5B7A", lineHeight: 1.7 }}>
                <strong style={{ color: "#2DD4BF" }}>Pertama kali masuk?</strong> Daftarkan sidik jari kamu dulu. Selanjutnya cukup scan sidik jari untuk masuk kasir.
              </div>
            </div>
            <button style={btnGrad} onClick={doRegister}>
              <i className="ti ti-fingerprint" /> Daftarkan Sidik Jari
            </button>
          </>
        ) : (
          <>
            <button style={btnGrad} onClick={doLogin}>
              <i className="ti ti-fingerprint" /> Masuk dengan Sidik Jari
            </button>
            <button onClick={() => setAuthMode("register")} style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "0.5px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", color: "#8B8AA0", fontSize: "12px", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", marginBottom: "8px" }}>
              Daftar ulang sidik jari
            </button>
          </>
        )}

        {fpStatus && (
          <div style={{ background: "rgba(236,72,153,.08)", border: "0.5px solid rgba(236,72,153,.2)", borderRadius: "8px", padding: "8px 12px", fontSize: "11px", color: "#EC4899", textAlign: "center", marginBottom: "8px" }}>
            {fpStatus}
          </div>
        )}

        <button onClick={() => setShowSOP(true)} style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "0.5px solid rgba(255,255,255,.08)", background: "none", color: "#8B8AA0", fontSize: "12px", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <i className="ti ti-book" /> Lihat SOP Kasir
        </button>
      </div>
      {showSOP && <SOPModal onClose={() => setShowSOP(false)} />}
    </div>
  );

  if (screen === "scanning") return (
    <div style={{ ...S, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at 50% 50%, rgba(45,212,191,.06) 0%, transparent 60%), #070711" }}>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
      <div style={{ width: "110px", height: "110px", borderRadius: "50%", border: "2px solid rgba(45,212,191,.5)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem", fontSize: "42px", color: "#2DD4BF", position: "relative" }}>
        <style>{`@keyframes scanPulse{0%,100%{box-shadow:0 0 0 0 rgba(45,212,191,.2)}50%{box-shadow:0 0 0 24px rgba(45,212,191,.03)}}`}</style>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", animation: "scanPulse 1.2s ease-in-out infinite" }} />
        <i className="ti ti-fingerprint" />
      </div>
      <div style={{ fontSize: "16px", fontWeight: 500, marginBottom: ".5rem" }}>{fpStatus || "Mendeteksi sidik jari..."}</div>
      <div style={{ fontSize: "12px", color: "#5A5B7A" }}>Ikuti instruksi di perangkat kamu</div>
    </div>
  );

  if (screen === "welcome") return (
    <div style={{ ...S, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", background: "radial-gradient(ellipse at 50% 30%, rgba(45,212,191,.1) 0%, transparent 60%), #070711" }}>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
      <div style={{ background: "#0D0D1A", border: "0.5px solid rgba(45,212,191,.2)", borderRadius: "20px", padding: "2rem", width: "100%", maxWidth: "340px", textAlign: "center" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(45,212,191,.12)", border: "0.5px solid rgba(45,212,191,.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "26px", color: "#2DD4BF" }}>✓</div>
        <div style={{ fontSize: "15px", fontWeight: 600, color: "#2DD4BF", marginBottom: ".25rem" }}>Selamat datang!</div>
        <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: ".2rem" }}>{employee.nama}</div>
        <div style={{ fontSize: "12px", color: "#5A5B7A", marginBottom: ".75rem" }}>{employee.jabatan}</div>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "14px", color: "#2DD4BF", marginBottom: ".5rem" }}>{clock}</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 12px", borderRadius: "20px", fontSize: "11px", background: "rgba(45,212,191,.1)", color: "#2DD4BF", border: "0.5px solid rgba(45,212,191,.25)", marginBottom: "1.5rem" }}>
          ● Check-in otomatis tercatat
        </div>
        <br /><br />
        <button style={btnGrad} onClick={() => setScreen("kasir")}>
          <i className="ti ti-cash-register" /> Buka Kasir
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ ...S, display: "flex", flexDirection: "column", minHeight: "100vh", overflow: "hidden" }}>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');body{margin:0}`}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "0.5px solid rgba(255,255,255,.06)", background: "#0D0D1A", flexShrink: 0, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap" }}>Gercep<span style={{ background: "linear-gradient(135deg,#2DD4BF,#8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI</span></div>
          <div style={{ width: "1px", height: "12px", background: "rgba(255,255,255,.08)", flexShrink: 0 }} />
          <div style={{ fontSize: "11px", color: "#5A5B7A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><strong style={{ color: "#F0EFF8" }}>{employee.nama}</strong></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "#2DD4BF" }}>{clock}</div>
          <button onClick={() => setShowSOP(true)} aria-label="SOP" style={{ background: "none", border: "0.5px solid rgba(255,255,255,.1)", color: "#8B8AA0", width: "28px", height: "28px", borderRadius: "8px", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-book" /></button>
          <div style={{ transform: "scale(0.85)", transformOrigin: "right center" }}><KasirReprintBar refreshKey={receiptVersion} /></div>
          <div style={{ transform: "scale(0.85)", transformOrigin: "right center" }}><KasirPrintSettingsButton /></div>
          <button onClick={() => setShowCheckout(true)} aria-label="Check-out" style={{ background: "rgba(236,72,153,.06)", border: "0.5px solid rgba(236,72,153,.2)", color: "#EC4899", width: "28px", height: "28px", borderRadius: "8px", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-logout" /></button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "6px", padding: "8px 10px", borderBottom: "0.5px solid rgba(255,255,255,.05)", flexShrink: 0 }}>
        {[
          { l: "Omzet", v: "Rp" + (stats.omzet >= 1000 ? Math.round(stats.omzet/1000) + "rb" : stats.omzet), c: "#2DD4BF" },
          { l: "Order", v: stats.totalOrders.toString(), c: "#8B5CF6" },
          { l: "Laba", v: "Rp" + (stats.laba >= 1000 ? Math.round(stats.laba/1000) + "rb" : stats.laba), c: "#F59E0B" },
          { l: "Food cost", v: stats.foodCost + "%", c: "#EC4899" },
        ].map(k => (
          <div key={k.l} style={{ background: "#0D0D1A", border: "0.5px solid rgba(255,255,255,.06)", borderRadius: "10px", padding: "7px 10px", borderBottom: "2px solid " + k.c }}>
            <div style={{ fontSize: "10px", color: "#5A5B7A", marginBottom: "2px" }}>{k.l}</div>
            <div style={{ fontSize: "13px", fontWeight: 600, fontFamily: "JetBrains Mono, monospace", color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderBottom: "0.5px solid rgba(255,255,255,.05)", flexShrink: 0 }}>
        <i className="ti ti-search" style={{ fontSize: "14px", color: "#3A3B52" }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari menu..." style={{ flex: 1, background: "none", border: "none", fontSize: "13px", color: "#F0EFF8", outline: "none", fontFamily: "'Space Grotesk', sans-serif" }} />
      </div>
      <div style={{ display: "flex", gap: "6px", padding: "8px 12px", borderBottom: "0.5px solid rgba(255,255,255,.05)", overflowX: "auto", flexShrink: 0, WebkitOverflowScrolling: "touch" }}>
        {categories.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ fontSize: "12px", padding: "5px 12px", borderRadius: "20px", border: "0.5px solid " + (activeTab === tab ? "rgba(45,212,191,.45)" : "rgba(255,255,255,.08)"), color: activeTab === tab ? "#2DD4BF" : "#5A5B7A", background: activeTab === tab ? "rgba(45,212,191,.08)" : "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>{tab}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "10px", padding: "10px 12px", flex: 1, paddingBottom: cartItems.length > 0 ? "92px" : "16px" }}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "3rem 1rem", color: "#3A3B52", fontSize: "13px" }}>Belum ada menu aktif</div>
        ) : filtered.map(m => {
          const qty = cart[m.id] || 0;
          const color = KATEGORI_COLOR[m.kategori || ""] || "#8B8AA0";
          const icon = KATEGORI_ICON[m.kategori || ""] || "ti-dots";
          const hpp = calcHpp(m);
          const mg = m.harga_jual > 0 ? Math.round((m.harga_jual - hpp) / m.harga_jual * 100) : 0;
          return (
            <div key={m.id} onClick={() => addItem(m.id)} style={{ background: "#0D0D1A", border: "0.5px solid " + (qty > 0 ? "rgba(45,212,191,.4)" : "rgba(255,255,255,.06)"), borderRadius: "14px", overflow: "hidden", cursor: "pointer", position: "relative" }}>
              {qty > 0 && <div style={{ position: "absolute", top: "8px", right: "8px", minWidth: "22px", height: "22px", padding: "0 5px", borderRadius: "11px", background: "#2DD4BF", color: "#070711", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{qty}</div>}
              <div style={{ height: "72px", display: "flex", alignItems: "center", justifyContent: "center", background: color + "12" }}>
                <i className={"ti " + icon} style={{ fontSize: "30px", color }} />
              </div>
              <div style={{ padding: "10px" }}>
                <div style={{ fontSize: "13px", fontWeight: 500, marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nama}</div>
                <div style={{ fontSize: "11px", color: "#5A5B7A", marginBottom: "6px" }}>HPP Rp{Math.round(hpp).toLocaleString("id-ID")} · {mg}%</div>
                <div style={{ fontSize: "15px", fontWeight: 600, fontFamily: "JetBrains Mono, monospace", color: "#2DD4BF", marginBottom: "8px" }}>Rp{m.harga_jual.toLocaleString("id-ID")}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <button onClick={e => { e.stopPropagation(); removeItem(m.id); }} aria-label="Kurangi" style={{ width: "30px", height: "30px", borderRadius: "9px", border: "0.5px solid " + (qty > 0 ? "rgba(45,212,191,.4)" : "rgba(255,255,255,.08)"), background: qty > 0 ? "rgba(45,212,191,.08)" : "rgba(255,255,255,.03)", color: qty > 0 ? "#2DD4BF" : "#5A5B7A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>−</button>
                  <span style={{ fontSize: "14px", fontFamily: "monospace", fontWeight: 600, color: qty > 0 ? "#2DD4BF" : "#3A3B52", minWidth: "18px", textAlign: "center" }}>{qty}</span>
                  <button onClick={e => { e.stopPropagation(); addItem(m.id); }} aria-label="Tambah" style={{ width: "30px", height: "30px", borderRadius: "9px", border: "0.5px solid rgba(45,212,191,.4)", background: "rgba(45,212,191,.08)", color: "#2DD4BF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>+</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {cartItems.length > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)} style={{ position: "sticky", bottom: "12px", left: "12px", right: "12px", margin: "0 12px", background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711", border: "none", borderRadius: "16px", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", zIndex: 60 }}>
          <span style={{ fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "rgba(7,7,17,.18)", borderRadius: "50%", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>{cartItems.reduce((s,c)=>s+c.qty,0)}</span>
            Lihat order
          </span>
          <span style={{ fontSize: "14px", fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>Rp{total.toLocaleString("id-ID")}</span>
        </button>
      )}

      {cartOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(7,7,17,.7)", zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={() => setCartOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0D0D1A", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ width: "36px", height: "4px", background: "rgba(255,255,255,.15)", borderRadius: "2px", margin: "10px auto" }} />
            <div style={{ padding: "0 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "0.5px solid rgba(255,255,255,.06)", paddingBottom: "12px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#2DD4BF", letterSpacing: ".08em", textTransform: "uppercase" }}>Order aktif</div>
                <div style={{ fontSize: "12px", color: "#5A5B7A" }}>{cartItems.length} item</div>
              </div>
              <button onClick={() => setCartOpen(false)} aria-label="Tutup" style={{ background: "rgba(255,255,255,.05)", border: "none", color: "#8B8AA0", width: "30px", height: "30px", borderRadius: "50%", fontSize: "16px", cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "10px 16px" }}>
              {cartItems.map(c => (
                <div key={c.menu.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 0", borderBottom: "0.5px solid rgba(255,255,255,.04)" }}>
                  <div style={{ flex: 1, fontSize: "13px", color: "#C4C3D4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.menu.nama}</div>
                  <button onClick={() => removeItem(c.menu.id)} aria-label="Kurangi" style={{ width: "26px", height: "26px", borderRadius: "8px", border: "0.5px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.03)", color: "#8B8AA0", fontSize: "14px", cursor: "pointer" }}>−</button>
                  <span style={{ fontSize: "13px", fontFamily: "monospace", minWidth: "16px", textAlign: "center" }}>{c.qty}</span>
                  <button onClick={() => addItem(c.menu.id)} aria-label="Tambah" style={{ width: "26px", height: "26px", borderRadius: "8px", border: "0.5px solid rgba(45,212,191,.4)", background: "rgba(45,212,191,.08)", color: "#2DD4BF", fontSize: "14px", cursor: "pointer" }}>+</button>
                  <div style={{ fontSize: "13px", fontFamily: "monospace", whiteSpace: "nowrap", minWidth: "78px", textAlign: "right" }}>Rp{(c.menu.harga_jual * c.qty).toLocaleString("id-ID")}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: "12px 16px", borderTop: "0.5px solid rgba(255,255,255,.06)", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#5A5B7A", marginBottom: "6px" }}><span>Subtotal</span><span style={{ fontFamily: "monospace" }}>Rp{subtotal.toLocaleString("id-ID")}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "#5A5B7A", flex: 1 }}>Diskon</span>
                <input type="number" value={diskon} onChange={e => setDiskon(e.target.value)} placeholder="0" style={{ width: "80px", fontSize: "12px", padding: "5px 8px", borderRadius: "8px", border: "0.5px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", color: "#F0EFF8", textAlign: "right", fontFamily: "monospace", outline: "none" }} />
                <span style={{ fontSize: "11px", color: "#5A5B7A" }}>Rp</span>
              </div>
              <div style={{ height: "0.5px", background: "rgba(255,255,255,.06)", margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px", fontWeight: 500 }}>Total</span>
                <span style={{ fontSize: "19px", fontWeight: 600, fontFamily: "JetBrains Mono, monospace", color: "#2DD4BF" }}>Rp{total.toLocaleString("id-ID")}</span>
              </div>
              <div style={{ fontSize: "11px", color: "#5A5B7A", marginBottom: "10px" }}>Laba est. <span style={{ color: "#2DD4BF" }}>Rp{Math.round(laba).toLocaleString("id-ID")}</span> · {margin}%</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "6px", marginBottom: "10px" }}>
                {[{ v: "tunai", l: "Tunai", icon: "ti-cash" }, { v: "qris", l: "QRIS", icon: "ti-qrcode" }, { v: "transfer", l: "Transfer", icon: "ti-credit-card" }].map(m => (
                  <button key={m.v} onClick={() => setMetodeBayar(m.v)} style={{ padding: "9px 4px", borderRadius: "10px", border: "0.5px solid " + (metodeBayar === m.v ? "rgba(45,212,191,.4)" : "rgba(255,255,255,.08)"), background: metodeBayar === m.v ? "rgba(45,212,191,.07)" : "none", color: metodeBayar === m.v ? "#2DD4BF" : "#5A5B7A", fontSize: "12px", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", textAlign: "center" }}>
                    <i className={"ti " + m.icon} style={{ display: "block", fontSize: "16px", marginBottom: "3px" }} />{m.l}
                  </button>
                ))}
              </div>
              <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan (meja, nama...)" style={{ width: "100%", fontSize: "13px", padding: "10px 12px", borderRadius: "10px", border: "0.5px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", color: "#F0EFF8", fontFamily: "'Space Grotesk', sans-serif", outline: "none", marginBottom: "10px" }} />
              {metodeBayar === "tunai" && (
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "10px", color: "#5A5B7A", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bayar tunai</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input type="number" value={bayar} onChange={e => setBayar(e.target.value)} placeholder={String(Math.ceil(total / 1000) * 1000)} style={{ flex: 1, fontSize: "13px", padding: "10px 12px", borderRadius: "10px", border: "0.5px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", color: "#F0EFF8", fontFamily: "JetBrains Mono, monospace", outline: "none" }} />
                    <span style={{ fontSize: "11px", color: "#5A5B7A" }}>Rp</span>
                  </div>
                  {Number(bayar) > total && (
                    <div style={{ fontSize: "11px", color: "#2DD4BF", marginTop: "4px" }}>Kembali Rp{(Number(bayar) - total).toLocaleString("id-ID")}</div>
                  )}
                </div>
              )}
              <button onClick={handleProses} disabled={loading || !cartItems.length} style={{ ...btnGrad, padding: "15px", fontSize: "14px", opacity: loading || !cartItems.length ? 0.35 : 1, cursor: loading || !cartItems.length ? "not-allowed" : "pointer" }}>
                {loading ? "Memproses..." : `Proses — Rp${total.toLocaleString("id-ID")}`}
              </button>
              <button onClick={() => { setCart({}); setDiskon(""); setBayar(""); setCatatan(""); setCartOpen(false); }} style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "0.5px solid rgba(236,72,153,.2)", background: "rgba(236,72,153,.04)", color: "#EC4899", fontSize: "12px", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>Reset order</button>
            </div>
          </div>
        </div>
      )}

      {printToast && (
        <div style={{ position: "fixed", bottom: "5rem", left: "50%", transform: "translateX(-50%)", zIndex: 190, background: "#0D0D1A", border: "0.5px solid rgba(45,212,191,.3)", borderRadius: "999px", padding: "10px 18px", fontSize: "12px", color: "#2DD4BF", fontWeight: 600, whiteSpace: "nowrap" }}>
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
          businessName={business.name}
          kasirName={employee.nama}
          onDone={() => setShowPrinterWizard(false)}
        />
      )}

      {showCheckout && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(7,7,17,.96)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "1rem" }}>
          <div style={{ background: "#0D0D1A", border: "0.5px solid rgba(236,72,153,.25)", borderRadius: "20px", padding: "1.75rem", maxWidth: "320px", width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: ".5rem" }}>Check-out Shift</div>
            {[["Kasir", employee.nama], ["Total order", stats.totalOrders.toString()], ["Total omzet", "Rp" + stats.omzet.toLocaleString("id-ID")], ["Total laba", "Rp" + stats.laba.toLocaleString("id-ID")]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "4px 0", borderBottom: "0.5px solid rgba(255,255,255,.04)" }}>
                <span style={{ color: "#5A5B7A" }}>{k}</span>
                <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#F0EFF8" }}>{v}</span>
              </div>
            ))}
            <div style={{ height: ".5px", background: "rgba(255,255,255,.06)", margin: "10px 0" }} />
            <button onClick={doCheckout} style={{ ...btnGrad, background: "linear-gradient(135deg,#EC4899,#8B5CF6)" }}>Konfirmasi Check-out</button>
            <button onClick={() => setShowCheckout(false)} style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "0.5px solid rgba(255,255,255,.08)", background: "none", color: "#8B8AA0", fontSize: "12px", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>Batal</button>
          </div>
        </div>
      )}

      {showSOP && <SOPModal onClose={() => setShowSOP(false)} />}
    </div>
  );
}

function SOPModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(7,7,17,.97)", zIndex: 300, overflowY: "auto", padding: "1.5rem" }}>
      <div style={{ background: "#0D0D1A", border: "0.5px solid rgba(255,255,255,.07)", borderRadius: "16px", padding: "1.5rem", maxWidth: "560px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div><div style={{ fontSize: "16px", fontWeight: 600, color: "#2DD4BF" }}>SOP Kasir GercepAI</div><div style={{ fontSize: "12px", color: "#5A5B7A", marginTop: "2px" }}>Standar Operasional Prosedur · F&B</div></div>
          <button onClick={onClose} style={{ background: "none", border: "0.5px solid rgba(255,255,255,.1)", color: "#8B8AA0", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>Tutup</button>
        </div>
        {[
          { title: "🌅 Membuka Kasir", steps: ["Buka link kasir di HP kamu", "Daftarkan sidik jari (pertama kali) atau scan sidik jari", "Check-in otomatis tercatat", "Siap terima order!"] },
          { title: "💳 Melayani Pelanggan", steps: ["Sapa pelanggan, tanyakan pesanan", "Pilih menu di aplikasi", "Cek ringkasan order", "Tanyakan metode bayar", "Input diskon jika ada", "Klik Proses — stok berkurang otomatis", "Ucapkan terima kasih"] },
          { title: "🌙 Menutup Kasir", steps: ["Pastikan semua transaksi selesai", "Klik Check-out di atas", "Cek ringkasan shift", "Konfirmasi Check-out"] },
        ].map(section => (
          <div key={section.title} style={{ marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#8B8AA0", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: ".6rem" }}>{section.title}</div>
            {section.steps.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", marginBottom: ".5rem" }}>
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(45,212,191,.12)", color: "#2DD4BF", fontSize: "10px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i+1}</div>
                <div style={{ fontSize: "12px", color: "#8B8AA0", lineHeight: 1.6 }}>{step}</div>
              </div>
            ))}
          </div>
        ))}
        <div style={{ background: "rgba(245,158,11,.06)", border: "0.5px solid rgba(245,158,11,.2)", borderRadius: "8px", padding: "10px 12px", fontSize: "11px", color: "#F59E0B", marginBottom: ".75rem" }}>
          ⚠️ Jangan proses transaksi sebelum pembayaran diterima. Semua transaksi terekam di dashboard owner.
        </div>
        <button onClick={onClose} style={{ width: "100%", padding: "11px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#2DD4BF,#8B5CF6)", color: "#070711", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>✓ Mengerti, Mulai Shift</button>
      </div>
    </div>
  );
}
