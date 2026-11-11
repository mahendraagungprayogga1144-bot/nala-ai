"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import {
  Briefcase,
  Camera,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileBarChart,
  Home,
  MapPinned,
  QrCode,
  ShoppingBag,
  Target,
  Wallet,
} from "lucide-react";
import { rememberFieldToken } from "@/lib/henima-tracking/field-app";
import { prepareFieldPhoto } from "@/lib/henima-tracking/field-photo";
import FieldClient, { type FieldState } from "./field-client";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type Tab = "home" | "lokasi" | "jual" | "bayar" | "laporan" | "target";

/** Aksen status — tanpa emas. */
const GREEN = "#2F9E68";

type PortalProduct = { id: string; name: string; price: number; stock: number | null };
type PortalOrder = {
  id: string;
  total: number;
  metode: string | null;
  status: string | null;
  catatan: string | null;
  orderDate: string;
  createdAt: string;
  items: string;
  productId?: string | null;
  productName?: string | null;
  quantity?: number;
  unitPrice?: number;
};
type PortalData = {
  actor: { staffId: string; nama: string; role: string; businessName: string };
  date: string;
  products: PortalProduct[];
  stats: {
    omzetHari: number;
    transaksiHari: number;
    botolHari: number;
    pendingCount: number;
    pendingTotal: number;
    setorCash: number;
    omzetBulan: number;
    targetBulan: number;
    progressBulan: number;
    terjualBulan: number;
  };
  recent: PortalOrder[];
  payments: PortalOrder[];
  monthOrders: PortalOrder[];
  monthly: { sold: number; omzet: number; target: number; remaining: number; achievement: number };
};

function rp(n: number) {
  return `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
}

function clock(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatLiveClock(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatLiveDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Draft angka: boleh kosong saat mengetik (supaya 0 tidak nempel / menimpa). */
function parseDigitDraft(raw: string) {
  if (raw.trim() === "") return "";
  if (!/^\d+$/.test(raw.trim())) return null;
  return raw.trim().replace(/^0+(?=\d)/, "") || "0";
}

function draftToInt(raw: string, fallback: number, min: number) {
  if (raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.round(n));
}

export default function SalesPortal({ token, field }: { token: string; field: FieldState }) {
  const [tab, setTab] = useState<Tab>("home");
  const [data, setData] = useState<PortalData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [trackLive, setTrackLive] = useState({
    checkedIn: field.checkedIn,
    checkedOut: field.checkedOut,
    watching: false,
  });

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/henima-tracking/field/${token}/portal`, { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || "Gagal memuat portal.");
    setData(json as PortalData);
    setLoadError("");
  }, [token]);

  useEffect(() => {
    rememberFieldToken(token);
    void refresh().catch((err) => setLoadError(err instanceof Error ? err.message : "Gagal memuat."));
  }, [refresh, token]);

  const nama = data?.actor.nama || field.nama;
  const gpsLive = !trackLive.checkedOut;

  return (
    <div
      className={`${jakarta.className} relative min-h-[100dvh] touch-pan-y bg-[#F7F7F5] text-[#111111]`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {/* Tetap mounted supaya auto GPS tidak mati saat pindah menu. Bottom nav selalu ada. */}
      <div
        className={
          tab === "lokasi"
            ? "relative block min-h-[100dvh]"
            : "pointer-events-none absolute inset-0 -z-10 h-0 w-0 overflow-hidden opacity-0"
        }
        aria-hidden={tab !== "lokasi"}
      >
        <FieldClient
          token={token}
          initial={field}
          embedded
          onBack={() => setTab("home")}
          onStatusChange={setTrackLive}
        />
      </div>

      {tab !== "lokasi" ? (
        <main className="mx-auto max-w-lg px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[calc(6.25rem+env(safe-area-inset-bottom,0px))]">
          {loadError ? (
            <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>
          ) : null}

          {tab === "home" ? (
            <HomeView
              nama={nama}
              data={data}
              hasCheckin={Boolean(field.hasCheckinPagi || trackLive.checkedIn)}
              checkedOut={trackLive.checkedOut}
              gpsLive={gpsLive && trackLive.watching}
              onOpen={setTab}
              onRefresh={() => void refresh().catch((err) => setLoadError(err.message))}
            />
          ) : null}
          {tab !== "home" ? (
            <div className="mb-3 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setTab("home")} className="text-sm font-semibold text-[#5C5C5C]">
                ← Home
              </button>
              <p className="text-sm font-bold text-[#111]">
                {tab === "jual"
                  ? "Catat jual"
                  : tab === "bayar"
                    ? "Pembayaran"
                    : tab === "laporan"
                      ? "Laporan"
                      : tab === "target"
                        ? "Target"
                        : ""}
              </p>
              <span className="w-12" />
            </div>
          ) : null}
          {tab === "jual" ? (
            <SaleView
              token={token}
              products={data?.products || []}
              busy={busy}
              setBusy={setBusy}
              onDone={() => {
                void refresh();
                setTab("bayar");
              }}
            />
          ) : null}
          {tab === "bayar" ? (
            <PayView
              token={token}
              products={data?.products || []}
              orders={data?.payments || []}
              setorCash={data?.stats.setorCash || 0}
              pendingTotal={data?.stats.pendingTotal || 0}
              onChanged={() => void refresh()}
            />
          ) : null}
          {tab === "laporan" ? <ReportView data={data} /> : null}
          {tab === "target" ? <TargetView data={data} /> : null}
        </main>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8E8E4] bg-white pb-[env(safe-area-inset-bottom,0px)]">
        <div className="relative mx-auto grid max-w-lg grid-cols-5 items-end px-1 pt-2 pb-1">
          {(
            [
              { id: "home", label: "Home", icon: Home },
              { id: "jual", label: "Jual", icon: ShoppingBag },
              { id: "lokasi", label: "GPS", icon: MapPinned, fab: true },
              { id: "bayar", label: "Bayar", icon: CreditCard },
              { id: "laporan", label: "Lapor", icon: FileBarChart },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id || (item.id === "home" && tab === "target");
            if ("fab" in item && item.fab) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab("lokasi")}
                  className="-mt-5 flex flex-col items-center justify-end gap-0.5"
                  aria-label="Lokasi GPS"
                >
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_8px_20px_rgba(47,158,104,0.35)]"
                    style={{ background: GREEN }}
                  >
                    <MapPinned size={22} strokeWidth={2.4} />
                  </span>
                  <span className={`text-[10px] font-semibold ${active ? "text-[#111]" : "text-[#8A8A8A]"}`}>GPS</span>
                </button>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[10px] font-semibold leading-none ${
                  active ? "text-[#111]" : "text-[#8A8A8A]"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 1.8} color={active ? GREEN : undefined} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function HomeView({
  nama,
  data,
  hasCheckin,
  checkedOut,
  gpsLive,
  onOpen,
  onRefresh,
}: {
  nama: string;
  data: PortalData | null;
  hasCheckin: boolean;
  checkedOut: boolean;
  gpsLive: boolean;
  onOpen: (tab: Tab) => void;
  onRefresh: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const grid: Array<{ label: string; icon: typeof MapPinned; onClick: () => void }> = [
    { label: "Hadir GPS", icon: MapPinned, onClick: () => onOpen("lokasi") },
    { label: "QRIS", icon: QrCode, onClick: () => onOpen("lokasi") },
    { label: "Catat jual", icon: ClipboardList, onClick: () => onOpen("jual") },
    { label: "Bayar", icon: Wallet, onClick: () => onOpen("bayar") },
    { label: "Laporan", icon: FileBarChart, onClick: () => onOpen("laporan") },
    { label: "Target", icon: Target, onClick: () => onOpen("target") },
    { label: "Kunjungan", icon: Briefcase, onClick: () => onOpen("lokasi") },
  ];

  const recent = data?.recent || [];

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-[#111]">{nama}</h1>
          <p className="mt-0.5 text-sm text-[#6B6B6B]">Sales lapangan · HENIMA</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#111] text-sm font-bold text-white"
          aria-label="Muat ulang"
        >
          {nama.slice(0, 1).toUpperCase()}
        </button>
      </header>

      <div className="text-center">
        <p className="text-[2.35rem] font-bold leading-none tracking-tight" style={{ color: GREEN }}>
          {formatLiveClock(now)}
        </p>
        <p className="mt-2 text-sm text-[#6B6B6B]">Hari ini: {formatLiveDate(now)}</p>
        {gpsLive ? (
          <p className="mt-2 text-xs font-semibold" style={{ color: GREEN }}>
            GPS hidup · update otomatis
          </p>
        ) : null}
      </div>

      <section className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[#E8E8E4] bg-white">
        <button type="button" onClick={() => onOpen("lokasi")} className="flex items-center gap-3 border-r border-[#E8E8E4] px-3 py-3.5 text-left">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EAF7F0]" style={{ color: GREEN }}>
            <Camera size={18} />
          </span>
          <span>
            <span className="block text-sm font-bold text-[#111]">Check-in</span>
            <span className="block text-xs font-semibold" style={{ color: GREEN }}>
              {hasCheckin ? "Sudah absen" : "Belum absen"}
            </span>
          </span>
        </button>
        <button type="button" onClick={() => onOpen("lokasi")} className="flex items-center gap-3 px-3 py-3.5 text-left">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F3F1] text-[#6B6B6B]">
            <Camera size={18} />
          </span>
          <span>
            <span className="block text-sm font-bold text-[#111]">Selesai kerja</span>
            <span className="block text-xs font-semibold text-[#6B6B6B]">{checkedOut ? "Selesai" : "Belum"}</span>
          </span>
        </button>
      </section>

      <section className="rounded-2xl border border-[#E8E8E4] bg-white p-3">
        <div className="grid grid-cols-4 gap-2">
          {grid.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-[#EEEEEC] bg-[#FAFAF8] px-1 py-2"
              >
                <Icon size={20} className="text-[#333]" strokeWidth={1.85} />
                <span className="text-center text-[10px] font-semibold leading-tight text-[#333]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#111]">Transaksi terbaru</h2>
          <button type="button" onClick={() => onOpen("laporan")} className="text-xs font-semibold text-[#6B6B6B]">
            Laporan
          </button>
        </div>
        {!recent.length ? (
          <p className="rounded-2xl border border-dashed border-[#E8E8E4] bg-white px-4 py-5 text-center text-sm text-[#6B6B6B]">
            Belum ada transaksi hari ini.
          </p>
        ) : (
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {recent.slice(0, 6).map((order) => (
              <li key={order.id} className="min-w-[9.5rem] rounded-2xl border border-[#E8E8E4] bg-white px-3 py-3">
                <p className="text-[11px] font-medium text-[#8A8A8A]">{clock(order.createdAt)}</p>
                <p className="mt-1 line-clamp-2 text-xs font-semibold text-[#111]">{order.items || "Transaksi"}</p>
                <p className="mt-2 text-sm font-bold" style={{ color: GREEN }}>
                  {rp(order.total)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Riwayat GPS sengaja tidak ditampilkan ke sales — hanya owner di dashboard. */}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#E8E8E4] bg-white px-2.5 py-3 shadow-[0_8px_24px_rgba(17,17,17,0.04)] sm:px-4">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[#8A8A8A] sm:text-[11px]">{label}</p>
      <p className="mt-1 break-words text-sm font-bold leading-tight sm:text-lg">{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-[#6B6B6B] sm:text-xs">{hint}</p>
    </div>
  );
}

function MenuRow({
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  icon: typeof MapPinned;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-[#E8E8E4] bg-white px-3.5 py-3 text-left shadow-[0_4px_16px_rgba(17,17,17,0.03)]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E8E8E4] bg-[#F7F7F5]">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-[#6B6B6B]">{desc}</span>
      </span>
      <ChevronRight size={16} className="text-[#B0B0B0]" />
    </button>
  );
}

function SaleView({
  token,
  products,
  busy,
  setBusy,
  onDone,
}: {
  token: string;
  products: PortalProduct[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onDone: () => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id || "");
  const selected = useMemo(() => products.find((p) => p.id === productId) || products[0], [products, productId]);
  const [qtyDraft, setQtyDraft] = useState("1");
  const [priceDraft, setPriceDraft] = useState(String(selected?.price || 0));
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [method, setMethod] = useState<"CASH" | "TRANSFER" | "QRIS">("CASH");
  const [status, setStatus] = useState<"PAID" | "PENDING">("PAID");
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (selected) {
      setProductId(selected.id);
      setPriceDraft(String(selected.price));
    }
  }, [selected]);

  async function submit() {
    const quantity = draftToInt(qtyDraft, 1, 1);
    const unitPrice = draftToInt(priceDraft, selected?.price || 0, 0);
    setQtyDraft(String(quantity));
    setPriceDraft(String(unitPrice));
    setBusy(true);
    setError("");
    setOk("");
    try {
      let proofPath: string | null = null;
      if (proof) {
        const ready = await prepareFieldPhoto(proof);
        const form = new FormData();
        form.append("file", ready);
        const up = await fetch(`/api/henima-tracking/field/${token}/sales`, { method: "POST", body: form });
        const upJson = await up.json();
        if (!up.ok) throw new Error(upJson.error || "Upload bukti gagal.");
        proofPath = upJson.path;
      }
      const response = await fetch(`/api/henima-tracking/field/${token}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selected?.id,
          quantity,
          unitPrice,
          customerName,
          customerPhone,
          paymentMethod: method,
          paymentStatus: status,
          notes,
          proofPath,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Gagal simpan penjualan.");
      setOk(json.duplicate ? "Transaksi sudah pernah tersimpan." : "Penjualan tersimpan ke database.");
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
      setProof(null);
      setQtyDraft("1");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  const qtyNum = draftToInt(qtyDraft, 1, 1);
  const priceNum = draftToInt(priceDraft, selected?.price || 0, 0);

  return (
    <div className="space-y-3 pb-2">
      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {ok ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p> : null}

      <section className="space-y-3 rounded-2xl border border-[#E8E8E4] bg-white p-4">
        <label className="block text-sm font-semibold text-[#111]">
          Produk
          <select
            value={selected?.id || ""}
            onChange={(e) => setProductId(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-3.5 text-sm"
          >
            {products.length === 0 && <option value="">Belum ada produk</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="text-sm font-semibold text-[#111]">Jumlah</p>
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQtyDraft(String(Math.max(1, qtyNum - 1)))}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#E8E8E4] text-xl font-bold text-[#111]"
            >
              −
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={qtyDraft}
              onChange={(e) => {
                const next = parseDigitDraft(e.target.value);
                if (next !== null) setQtyDraft(next === "0" ? "" : next);
              }}
              onBlur={() => setQtyDraft(String(draftToInt(qtyDraft, 1, 1)))}
              onFocus={(e) => e.currentTarget.select()}
              className="h-12 min-w-0 flex-1 rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 text-center text-lg font-bold"
            />
            <button
              type="button"
              onClick={() => setQtyDraft(String(qtyNum + 1))}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#E8E8E4] text-xl font-bold text-[#111]"
            >
              +
            </button>
          </div>
        </div>

        <label className="block text-sm font-semibold text-[#111]">
          Harga unit
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={priceDraft}
            onChange={(e) => {
              const next = parseDigitDraft(e.target.value);
              if (next !== null) setPriceDraft(next);
            }}
            onBlur={() => setPriceDraft(String(draftToInt(priceDraft, selected?.price || 0, 0)))}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1.5 w-full rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-3.5 text-sm font-semibold"
          />
        </label>

        <div className="rounded-xl bg-[#F3F7F4] px-3 py-3">
          <p className="text-xs font-medium text-[#6B6B6B]">Total</p>
          <p className="text-2xl font-bold text-[#111]">{rp(qtyNum * priceNum)}</p>
        </div>

        <label className="block text-sm font-semibold text-[#111]">
          Nama pelanggan
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-3.5 text-sm"
            placeholder="Nama pembeli"
          />
        </label>

        <div>
          <p className="text-sm font-semibold text-[#111]">Bayar</p>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {(["CASH", "TRANSFER", "QRIS"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`rounded-xl border py-2.5 text-xs font-bold ${
                  method === m ? "border-transparent text-white" : "border-[#E8E8E4] bg-white text-[#6B6B6B]"
                }`}
                style={method === m ? { background: GREEN } : undefined}
              >
                {m === "CASH" ? "Tunai" : m === "TRANSFER" ? "TF" : "QRIS"}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["PAID", "PENDING"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-xl border py-2.5 text-xs font-bold ${
                  status === s ? "border-[#111] bg-[#111] text-white" : "border-[#E8E8E4] bg-white text-[#6B6B6B]"
                }`}
              >
                {s === "PAID" ? "Lunas" : "Belum lunas"}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm font-semibold text-[#111]">
          Catatan <span className="font-normal text-[#8A8A8A]">(opsional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1.5 w-full rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-3 text-sm"
            placeholder="Catatan singkat"
          />
        </label>

        <label className="block text-sm font-semibold text-[#111]">
          Bukti bayar <span className="font-normal text-[#8A8A8A]">(opsional)</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="mt-1.5 block w-full text-xs"
            onChange={(e) => setProof(e.target.files?.[0] || null)}
          />
        </label>
      </section>

      <button
        type="button"
        disabled={busy || !selected || !customerName.trim()}
        onClick={() => void submit()}
        className="w-full rounded-2xl py-4 text-sm font-bold text-white disabled:opacity-40"
        style={{ background: GREEN }}
      >
        {busy ? "Menyimpan…" : "Simpan penjualan"}
      </button>
      <p className="text-center text-xs text-[#8A8A8A]">Pastikan data benar sebelum disimpan.</p>
    </div>
  );
}

function PayView({
  token,
  products,
  orders,
  setorCash,
  pendingTotal,
  onChanged,
}: {
  token: string;
  products: PortalProduct[];
  orders: PortalOrder[];
  setorCash: number;
  pendingTotal: number;
  onChanged: () => void;
}) {
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProductId, setEditProductId] = useState("");
  const [editQtyDraft, setEditQtyDraft] = useState("1");
  const [editPriceDraft, setEditPriceDraft] = useState("0");
  const [editMethod, setEditMethod] = useState<"CASH" | "TRANSFER" | "QRIS">("CASH");
  const [editStatus, setEditStatus] = useState<"PAID" | "PENDING">("PAID");
  const [editNotes, setEditNotes] = useState("");
  const editQty = draftToInt(editQtyDraft, 1, 1);
  const editPrice = draftToInt(editPriceDraft, 0, 0);

  function startEdit(order: PortalOrder) {
    setEditingId(order.id);
    setEditProductId(order.productId || products[0]?.id || "");
    setEditQtyDraft(String(Math.max(1, order.quantity || 1)));
    setEditPriceDraft(String(Math.max(0, order.unitPrice || 0)));
    const metode = (order.metode || "CASH").toUpperCase();
    setEditMethod(metode === "TRANSFER" || metode === "QRIS" ? metode : "CASH");
    setEditStatus(order.status === "PENDING" ? "PENDING" : "PAID");
    setEditNotes((order.catatan || "").replace(/\s*·?\s*bukti:[^\s]+/g, "").trim());
    setError("");
    setOk("");
  }

  async function markPaid(orderId: string) {
    setBusyId(orderId);
    setError("");
    setOk("");
    try {
      const response = await fetch(`/api/henima-tracking/field/${token}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_payment", orderId, paymentStatus: "PAID" }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Gagal update.");
      setOk("Ditandai lunas.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal update.");
    } finally {
      setBusyId("");
    }
  }

  async function saveEdit(orderId: string) {
    const quantity = draftToInt(editQtyDraft, 1, 1);
    const unitPrice = draftToInt(editPriceDraft, 0, 0);
    setEditQtyDraft(String(quantity));
    setEditPriceDraft(String(unitPrice));
    setBusyId(orderId);
    setError("");
    setOk("");
    try {
      const response = await fetch(`/api/henima-tracking/field/${token}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_sale",
          orderId,
          productId: editProductId,
          quantity,
          unitPrice,
          paymentMethod: editMethod,
          paymentStatus: editStatus,
          notes: editNotes,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Gagal mengubah.");
      setEditingId(null);
      setOk("Transaksi berhasil diubah.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah.");
    } finally {
      setBusyId("");
    }
  }

  async function removeSale(orderId: string) {
    if (!window.confirm("Hapus transaksi ini? Data hilang dari laporan (bisa dilihat owner di riwayat hapus).")) return;
    setBusyId(orderId);
    setError("");
    setOk("");
    try {
      const response = await fetch(`/api/henima-tracking/field/${token}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_sale", orderId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Gagal menghapus.");
      if (editingId === orderId) setEditingId(null);
      setOk("Transaksi dihapus.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {ok && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}
      <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8A8A]">Belum lunas</p>
        <p className="mt-1 text-3xl font-bold text-[#111]">{rp(pendingTotal)}</p>
        <p className="mt-1 text-xs text-[#6B6B6B]">
          {orders.filter((o) => o.status === "PENDING").length} order · setor cash hari ini {rp(setorCash)}
        </p>
      </section>
      <p className="text-sm font-bold text-[#111]">Daftar tagihan</p>
      {!orders.length ? (
        <p className="rounded-2xl border border-dashed border-[#E8E8E4] bg-white px-4 py-8 text-center text-sm text-[#6B6B6B]">
          Belum ada transaksi hari ini.
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => (
            <li key={order.id} className="rounded-2xl border border-[#E8E8E4] bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{order.items || "Transaksi"}</p>
                  <p className="mt-0.5 text-xs text-[#6B6B6B]">
                    {order.metode || "—"} · {order.status === "PAID" ? "Lunas" : "Belum lunas"} · {clock(order.createdAt)}
                  </p>
                </div>
                <p className="text-sm font-bold">{rp(order.total)}</p>
              </div>

              {editingId === order.id ? (
                <div className="mt-3 space-y-2 border-t border-[#E8E8E4] pt-3">
                  <label className="block text-xs font-semibold">
                    Produk
                    <select
                      value={editProductId}
                      onChange={(e) => {
                        setEditProductId(e.target.value);
                        const p = products.find((x) => x.id === e.target.value);
                        if (p) setEditPriceDraft(String(p.price));
                      }}
                      className="mt-1 w-full rounded-xl border border-[#E8E8E4] px-3 py-2 text-sm"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs font-semibold">
                      Jumlah
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={editQtyDraft}
                        onChange={(e) => {
                          const next = parseDigitDraft(e.target.value);
                          if (next !== null) setEditQtyDraft(next === "0" ? "" : next);
                        }}
                        onBlur={() => setEditQtyDraft(String(draftToInt(editQtyDraft, 1, 1)))}
                        className="mt-1 w-full rounded-xl border border-[#E8E8E4] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-xs font-semibold">
                      Harga
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={editPriceDraft}
                        onChange={(e) => {
                          const next = parseDigitDraft(e.target.value);
                          if (next !== null) setEditPriceDraft(next);
                        }}
                        onBlur={() => setEditPriceDraft(String(draftToInt(editPriceDraft, 0, 0)))}
                        className="mt-1 w-full rounded-xl border border-[#E8E8E4] px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(["CASH", "TRANSFER", "QRIS"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setEditMethod(m)}
                        className={`rounded-lg border py-2 text-[10px] font-bold ${
                          editMethod === m ? "border-[#111] bg-[#111] text-white" : "border-[#E8E8E4]"
                        }`}
                      >
                        {m === "CASH" ? "Tunai" : m === "TRANSFER" ? "TF" : "QRIS"}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {(["PAID", "PENDING"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditStatus(s)}
                        className={`rounded-lg border py-2 text-[10px] font-bold ${
                          editStatus === s ? "border-[#111] bg-[#111] text-white" : "border-[#E8E8E4]"
                        }`}
                      >
                        {s === "PAID" ? "Lunas" : "Belum lunas"}
                      </button>
                    ))}
                  </div>
                  <label className="block text-xs font-semibold">
                    Catatan
                    <input
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#E8E8E4] px-3 py-2 text-sm"
                    />
                  </label>
                  <p className="text-xs font-semibold">Total baru: {rp(editQty * editPrice)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => setEditingId(null)}
                      className="rounded-xl border border-[#E8E8E4] py-2 text-xs font-bold"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={busyId === order.id || !editProductId}
                      onClick={() => void saveEdit(order.id)}
                      className="rounded-xl bg-[#111] py-2 text-xs font-bold text-white disabled:opacity-40"
                    >
                      {busyId === order.id ? "Menyimpan…" : "Simpan edit"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {order.status === "PENDING" && (
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => void markPaid(order.id)}
                      className="col-span-2 rounded-xl py-2.5 text-xs font-bold text-white"
                      style={{ background: GREEN }}
                    >
                      {busyId === order.id ? "Menyimpan…" : "Tandai lunas / unggah bukti"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => startEdit(order)}
                    className="rounded-xl border border-[#E8E8E4] py-2 text-xs font-bold"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => void removeSale(order.id)}
                    className="rounded-xl border border-rose-200 py-2 text-xs font-bold text-rose-600"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportView({ data }: { data: PortalData | null }) {
  const month = data?.monthOrders || [];
  const bottles = month.reduce((s, o) => {
    const m = o.items.match(/×(\d+)/g);
    if (!m) return s;
    return s + m.reduce((a, part) => a + Number(part.replace("×", "") || 0), 0);
  }, 0);
  const omzet = month.reduce((s, o) => s + o.total, 0);
  const top = new Map<string, number>();
  for (const order of month) {
    for (const part of order.items.split(", ")) {
      const name = part.replace(/\s*×\d+$/, "").trim() || "Produk";
      const qty = Number((part.match(/×(\d+)/) || [])[1] || 1);
      top.set(name, (top.get(name) || 0) + qty);
    }
  }
  const best = [...top.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Omzet hari ini" value={rp(data?.stats.omzetHari || 0)} hint={`${data?.stats.transaksiHari || 0} transaksi`} />
        <StatCard label="Omzet bulan" value={rp(omzet || data?.stats.omzetBulan || 0)} hint="Bulan berjalan" />
        <StatCard label="Transaksi" value={`${data?.stats.transaksiHari || 0}`} hint="Hari ini" />
        <StatCard label="Botol" value={`${bottles || data?.stats.terjualBulan || 0}`} hint="Bulan ini" />
      </div>
      <div className="rounded-2xl border border-[#E8E8E4] bg-white px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8A8A]">Produk terlaris</p>
        <p className="mt-1 text-sm font-bold">{best ? `${best[0]} · ${best[1]} botol` : "Belum ada data"}</p>
      </div>
      <p className="text-sm font-bold text-[#111]">Penjualan terbaru</p>
      <ul className="space-y-2">
        {month.slice(0, 20).map((order) => (
          <li key={order.id} className="rounded-2xl border border-[#E8E8E4] bg-white px-4 py-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="font-semibold">{order.items || "Transaksi"}</span>
              <span className="font-bold" style={{ color: GREEN }}>
                {rp(order.total)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#6B6B6B]">
              {order.orderDate} · {clock(order.createdAt)}
            </p>
          </li>
        ))}
        {!month.length && <p className="text-sm text-[#6B6B6B]">Belum ada transaksi bulan ini.</p>}
      </ul>
    </div>
  );
}

function TargetView({ data }: { data: PortalData | null }) {
  const m = data?.monthly;
  const pct = Math.min(100, Math.round(m?.achievement || 0));
  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-[#E8E8E4] bg-white p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8A8A]">Target bulan ini</p>
        <p className="mt-3 text-5xl font-bold tabular-nums" style={{ color: GREEN }}>
          {pct}%
        </p>
        <p className="mt-2 text-sm font-semibold text-[#111]">
          {m?.sold || 0} / {m?.target || 0} botol
        </p>
        <div className="mx-auto mt-4 h-2.5 max-w-xs overflow-hidden rounded-full bg-[#EFEFEA]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: GREEN }} />
        </div>
        <p className="mt-3 text-sm text-[#6B6B6B]">Sisa {m?.remaining || 0} botol</p>
        <p className="mt-1 text-sm font-bold text-[#111]">Omzet {rp(m?.omzet || 0)}</p>
      </section>
      <p className="rounded-2xl border border-[#E8E8E4] bg-white px-4 py-3 text-sm leading-snug text-[#6B6B6B]">
        Progress dari transaksi lunas. Bonus mengikuti aturan komisi di dashboard owner.
      </p>
    </div>
  );
}
