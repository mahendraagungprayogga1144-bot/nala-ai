"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart, Clock, BarChart3, Users, LogOut, Store, KeyRound,
  Package, Maximize2, Minimize2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Product, KasirShift, TodaySale, RetailStaff } from "./page";
import KasirPOS from "./components/kasir-pos";
import KasirShiftPanel from "./components/kasir-shift";
import KasirRekap from "./components/kasir-rekap";
import KasirTim from "./components/kasir-tim";
import KasirProduk from "./components/kasir-produk";

const TABS = [
  { id: "kasir", label: "Kasir", icon: ShoppingCart },
  { id: "produk", label: "Produk", icon: Package },
  { id: "shift", label: "Shift", icon: Clock },
  { id: "rekap", label: "Rekap", icon: BarChart3 },
  { id: "tim", label: "Tim", icon: Users },
] as const;

type TabId = (typeof TABS)[number]["id"];

type StaffSession = { id: string; nama: string };

function sessionKey(businessId: string) {
  return `retail_kasir_staff_${businessId}`;
}

/** Standalone retail POS shell — light mint/green, bukan tema dashboard gelap. */
const shell: CSSProperties = {
  background:
    "radial-gradient(1200px 500px at 10% -10%, #D8F3E4 0%, transparent 55%), radial-gradient(900px 400px at 100% 0%, #E8EEF2 0%, transparent 50%), #F2F6F4",
  color: "#0F1F17",
  minHeight: "100%",
  fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
};

export default function AiKasirClient({
  userId, businessId, businessName, storeName: initialStoreName,
  products, activeShift, todaySales, todayShifts, staff, today,
}: {
  userId: string; businessId: string; businessName: string; storeName: string;
  products: Product[]; activeShift: KasirShift | null;
  todaySales: TodaySale[]; todayShifts: KasirShift[];
  staff: RetailStaff[]; today: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<TabId>("kasir");
  const [storeName, setStoreName] = useState(initialStoreName);
  const [storeDraft, setStoreDraft] = useState(initialStoreName || businessName || "");
  const [session, setSession] = useState<StaffSession | null>(null);
  const [pin, setPin] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [boot, setBoot] = useState(true);
  const [savingStore, setSavingStore] = useState(false);
  const [loginErr, setLoginErr] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(sessionKey(businessId));
      if (raw) setSession(JSON.parse(raw) as StaffSession);
    } catch { /* ignore */ }
    setBoot(false);
  }, [businessId]);

  const omzetHariIni = todaySales.reduce((s, t) => s + Number(t.total), 0);
  const totalOrder = todaySales.length;
  const displayName = storeName || businessName;
  const activeStaff = staff.filter((s) => s.aktif);

  const saveStoreName = async () => {
    const name = storeDraft.trim();
    if (!name) return;
    setSavingStore(true);
    const { error } = await supabase.from("retail_kasir_settings").upsert({
      business_id: businessId,
      user_id: userId,
      store_name: name,
      updated_at: new Date().toISOString(),
    });
    setSavingStore(false);
    if (error) {
      alert("Gagal simpan nama usaha: " + error.message + "\nPastikan SQL migrasi retail_kasir sudah dijalankan.");
      return;
    }
    setStoreName(name);
    router.refresh();
  };

  const loginStaff = () => {
    setLoginErr("");
    const member = activeStaff.find((s) => s.id === selectedStaffId);
    if (!member) {
      setLoginErr("Pilih karyawan dulu.");
      return;
    }
    if (member.pin !== pin.trim()) {
      setLoginErr("PIN salah.");
      return;
    }
    const next = { id: member.id, nama: member.nama };
    sessionStorage.setItem(sessionKey(businessId), JSON.stringify(next));
    setSession(next);
    setPin("");
  };

  const logoutStaff = () => {
    sessionStorage.removeItem(sessionKey(businessId));
    setSession(null);
    setPin("");
  };

  if (boot) {
    return (
      <div className="-mx-3 -mt-3 min-h-[70vh] sm:-mx-8 sm:-mt-6" style={shell}>
        <p className="px-8 py-16 text-center text-sm text-[#5C6B63]">Memuat AI Kasir…</p>
      </div>
    );
  }

  // Gate 1: nama usaha di dalam modul kasir
  if (!storeName.trim()) {
    return (
      <div className="-mx-3 -mt-3 min-h-[70vh] sm:-mx-8 sm:-mt-6" style={shell}>
        <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-16">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#007A4D] text-white shadow-lg shadow-[#007A4D]/25">
            <Store size={28} />
          </div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#007A4D]">AI Kasir</p>
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-[#0F1F17]">Nama usaha toko</h1>
          <p className="mb-6 text-sm leading-relaxed text-[#5C6B63]">
            Ini aplikasi kasir retail mandiri — bukan Kasir F&B dan tidak otomatis masuk Keuangan Bisnis.
            Isi nama toko yang tampil di struk.
          </p>
          <label className="mb-1.5 block text-xs font-medium text-[#3D4F45]">Nama toko / usaha</label>
          <input
            value={storeDraft}
            onChange={(e) => setStoreDraft(e.target.value)}
            placeholder="Contoh: Toko Sembako Maju"
            className="mb-4 w-full rounded-xl border border-[#C5D4CB] bg-white px-4 py-3 text-sm text-[#0F1F17] outline-none ring-[#007A4D]/30 focus:ring-2"
          />
          <button
            type="button"
            disabled={savingStore || !storeDraft.trim()}
            onClick={saveStoreName}
            className="w-full rounded-xl bg-[#007A4D] py-3.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {savingStore ? "Menyimpan…" : "Lanjut ke login karyawan"}
          </button>
        </div>
      </div>
    );
  }

  // Gate 2: login karyawan (PIN)
  if (!session) {
    return (
      <div className="-mx-3 -mt-3 min-h-[70vh] sm:-mx-8 sm:-mt-6" style={shell}>
        <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-16">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F1F17] text-[#7DFFB3]">
            <KeyRound size={26} />
          </div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#007A4D]">{displayName}</p>
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Login kasir</h1>
          <p className="mb-6 text-sm text-[#5C6B63]">
            Pilih karyawan yang jaga kasir hari ini. Data tim live dari tab Tim.
          </p>

          {activeStaff.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#007A4D]/35 bg-white/70 p-5 text-center">
              <p className="mb-3 text-sm text-[#3D4F45]">Belum ada karyawan. Tambah dulu di Tim (mode owner).</p>
              <button
                type="button"
                onClick={() => {
                  const owner = { id: "owner", nama: "Owner" };
                  sessionStorage.setItem(sessionKey(businessId), JSON.stringify(owner));
                  setSession(owner);
                  setTab("tim");
                }}
                className="rounded-xl bg-[#007A4D] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Masuk sebagai owner → atur Tim
              </button>
            </div>
          ) : (
            <>
              <label className="mb-1.5 block text-xs font-medium text-[#3D4F45]">Karyawan</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="mb-4 w-full rounded-xl border border-[#C5D4CB] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#007A4D]/30"
              >
                <option value="">— Pilih —</option>
                {activeStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.nama}</option>
                ))}
              </select>
              <label className="mb-1.5 block text-xs font-medium text-[#3D4F45]">PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="mb-2 w-full rounded-xl border border-[#C5D4CB] bg-white px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:ring-2 focus:ring-[#007A4D]/30"
                onKeyDown={(e) => e.key === "Enter" && loginStaff()}
              />
              {loginErr && <p className="mb-2 text-xs text-[#B42318]">{loginErr}</p>}
              <button
                type="button"
                onClick={loginStaff}
                className="mt-2 w-full rounded-xl bg-[#007A4D] py-3.5 text-sm font-semibold text-white"
              >
                Buka kasir
              </button>
              <button
                type="button"
                onClick={() => {
                  const owner = { id: "owner", nama: "Owner" };
                  sessionStorage.setItem(sessionKey(businessId), JSON.stringify(owner));
                  setSession(owner);
                  setTab("tim");
                }}
                className="mt-3 text-center text-xs text-[#5C6B63] underline-offset-2 hover:underline"
              >
                Atau masuk sebagai owner (kelola tim)
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[90] overflow-y-auto pb-16"
          : "-mx-3 -mt-3 min-h-[70vh] pb-16 sm:-mx-8 sm:-mt-6"
      }
      style={shell}
    >
      <header className="sticky top-0 z-20 border-b border-[#C5D4CB]/80 bg-[#F2F6F4]/90 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#007A4D] text-white">
            <Store size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight text-[#0F1F17] sm:text-xl">
              {displayName}
            </h1>
            <p className="text-[11px] text-[#5C6B63]">
              AI Kasir retail · kasir <span className="font-semibold text-[#007A4D]">{session.nama}</span>
              {" · "}tidak sync Keuangan Bisnis
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#C5D4CB] bg-white px-3 py-2 text-xs font-medium text-[#3D4F45]"
            title={fullscreen ? "Keluar layar penuh" : "Mode layar penuh (sembunyikan menu Gercep)"}
          >
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="hidden sm:inline">{fullscreen ? "Keluar" : "Layar penuh"}</span>
          </button>
          <button
            type="button"
            onClick={logoutStaff}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#C5D4CB] bg-white px-3 py-2 text-xs font-medium text-[#3D4F45]"
          >
            <LogOut size={13} /> Ganti kasir
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto px-3 pb-3 scrollbar-none sm:px-8">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors " +
                  (active
                    ? "bg-[#007A4D] text-white shadow-sm shadow-[#007A4D]/25"
                    : "bg-white/70 text-[#5C6B63] hover:bg-white")
                }
              >
                <t.icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="px-3 py-4 sm:px-8 sm:py-5">
        {tab === "kasir" && (
          <KasirPOS
            userId={userId}
            businessId={businessId}
            businessName={displayName}
            products={products}
            activeShift={activeShift}
            today={today}
            omzetHariIni={omzetHariIni}
            totalOrder={totalOrder}
            staffName={session.nama}
            onGoProduk={() => setTab("produk")}
          />
        )}
        {tab === "produk" && (
          <KasirProduk userId={userId} businessId={businessId} products={products} />
        )}
        {tab === "shift" && (
          <KasirShiftPanel
            userId={userId}
            businessId={businessId}
            activeShift={activeShift}
            todayShifts={todayShifts}
            omzetHariIni={omzetHariIni}
            totalOrder={totalOrder}
            staffId={session.id === "owner" ? null : session.id}
            staffName={session.nama}
          />
        )}
        {tab === "rekap" && (
          <KasirRekap
            todaySales={todaySales}
            todayShifts={todayShifts}
            omzetHariIni={omzetHariIni}
            totalOrder={totalOrder}
            today={today}
          />
        )}
        {tab === "tim" && (
          <KasirTim
            userId={userId}
            businessId={businessId}
            staff={staff}
            storeName={displayName}
            onRenameStore={async (name) => {
              const { error } = await supabase.from("retail_kasir_settings").upsert({
                business_id: businessId,
                user_id: userId,
                store_name: name,
                updated_at: new Date().toISOString(),
              });
              if (error) {
                alert(error.message);
                return;
              }
              setStoreName(name);
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
