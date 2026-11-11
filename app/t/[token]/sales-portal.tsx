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
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(selected?.price || 0);
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
      setPrice(selected.price);
    }
  }, [selected]);

  async function submit() {
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
          quantity: qty,
          unitPrice: price,
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
      setQty(1);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-2">
      <div>
        <h1 className="text-xl font-bold">Catat Penjualan</h1>
        <p className="mt-1 text-sm leading-snug text-[#6B6B6B]">Data langsung masuk database & terlihat di dashboard owner.</p>
      </div>
      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {ok ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p> : null}

      <label className="block text-sm font-semibold">
        Produk
        <select
          value={selected?.id || ""}
          onChange={(e) => setProductId(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[#E8E8E4] bg-white px-3 py-3 text-sm"
        >
          {products.length === 0 && <option value="">Belum ada produk di bisnis</option>}
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {rp(p.price)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold">
          Jumlah botol
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 w-full rounded-xl border border-[#E8E8E4] bg-white px-3 py-3 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold">
          Harga jual
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 w-full rounded-xl border border-[#E8E8E4] bg-white px-3 py-3 text-sm"
          />
        </label>
      </div>

      <label className="block text-sm font-semibold">
        Nama pelanggan
        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[#E8E8E4] bg-white px-3 py-3 text-sm"
          placeholder="Nama pembeli"
        />
      </label>
      <label className="block text-sm font-semibold">
        WhatsApp (opsional)
        <input
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[#E8E8E4] bg-white px-3 py-3 text-sm"
          placeholder="08…"
        />
      </label>

      <div className="grid grid-cols-3 gap-2">
        {(["CASH", "TRANSFER", "QRIS"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`rounded-xl border px-2 py-2.5 text-xs font-bold ${
              method === m ? "border-[#111] bg-[#111] text-white" : "border-[#E8E8E4] bg-white text-[#6B6B6B]"
            }`}
          >
            {m === "CASH" ? "Tunai" : m === "TRANSFER" ? "Transfer" : "QRIS"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["PAID", "PENDING"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-xl border px-2 py-2.5 text-xs font-bold ${
              status === s ? "border-[#111] bg-[#111] text-white" : "border-[#E8E8E4] bg-white text-[#6B6B6B]"
            }`}
          >
            {s === "PAID" ? "Lunas" : "Belum lunas"}
          </button>
        ))}
      </div>

      <label className="block text-sm font-semibold">
        Catatan
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-xl border border-[#E8E8E4] bg-white px-3 py-3 text-sm"
          placeholder="Opsional"
        />
      </label>

      <label className="block text-sm font-semibold">
        Bukti transaksi
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="mt-1 block w-full text-xs"
          onChange={(e) => setProof(e.target.files?.[0] || null)}
        />
      </label>

      <p className="text-sm font-semibold">
        Total: <span className="text-lg">{rp(qty * price)}</span>
      </p>

      <button
        type="button"
        disabled={busy || !selected || !customerName.trim()}
        onClick={() => void submit()}
        className="w-full rounded-2xl bg-[#111] py-3.5 text-sm font-bold text-white disabled:opacity-40"
      >
        {busy ? "Menyimpan…" : "Simpan penjualan"}
      </button>
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
  const [editQty, setEditQty] = useState(1);
  const [editPrice, setEditPrice] = useState(0);
  const [editMethod, setEditMethod] = useState<"CASH" | "TRANSFER" | "QRIS">("CASH");
  const [editStatus, setEditStatus] = useState<"PAID" | "PENDING">("PAID");
  const [editNotes, setEditNotes] = useState("");

  function startEdit(order: PortalOrder) {
    setEditingId(order.id);
    setEditProductId(order.productId || products[0]?.id || "");
    setEditQty(Math.max(1, order.quantity || 1));
    setEditPrice(Math.max(0, order.unitPrice || 0));
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
          quantity: editQty,
          unitPrice: editPrice,
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
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Pembayaran</h1>
      <p className="text-sm text-[#6B6B6B]">Salah input? Edit atau hapus transaksi hari ini di sini.</p>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Setor tunai" value={rp(setorCash)} hint="Lunas hari ini" />
        <StatCard label="Belum lunas" value={rp(pendingTotal)} hint={`${orders.filter((o) => o.status === "PENDING").length} order`} />
      </div>
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {ok && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}
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
                        if (p) setEditPrice(p.price);
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
                        type="number"
                        min={1}
                        value={editQty}
                        onChange={(e) => setEditQty(Math.max(1, Number(e.target.value) || 1))}
                        className="mt-1 w-full rounded-xl border border-[#E8E8E4] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-xs font-semibold">
                      Harga
                      <input
                        type="number"
                        min={0}
                        value={editPrice}
                        onChange={(e) => setEditPrice(Math.max(0, Number(e.target.value) || 0))}
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
                      className="col-span-2 rounded-xl border border-[#111] py-2 text-xs font-bold"
                    >
                      {busyId === order.id ? "Menyimpan…" : "Tandai lunas"}
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
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Laporan Penjualan</h1>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Omzet hari ini" value={rp(data?.stats.omzetHari || 0)} hint={`${data?.stats.transaksiHari || 0} order`} />
        <StatCard label="Omzet bulan ini" value={rp(omzet || data?.stats.omzetBulan || 0)} hint={`${bottles || data?.stats.terjualBulan || 0} botol`} />
      </div>
      <div className="rounded-2xl border border-[#E8E8E4] bg-white px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8A8A]">Produk terlaris (bulan ini)</p>
        <p className="mt-1 text-sm font-bold">{best ? `${best[0]} · ${best[1]} botol` : "Belum ada data"}</p>
      </div>
      <ul className="space-y-2">
        {month.slice(0, 20).map((order) => (
          <li key={order.id} className="rounded-2xl border border-[#E8E8E4] bg-white px-4 py-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="font-semibold">{order.orderDate}</span>
              <span className="font-bold">{rp(order.total)}</span>
            </div>
            <p className="mt-0.5 text-xs text-[#6B6B6B]">{order.items}</p>
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
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Target & Bonus</h1>
      <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8A8A]">Target bulanan</p>
        <p className="mt-1 text-2xl font-bold">
          {m?.sold || 0} / {m?.target || 0} botol
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EFEFEA]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: GREEN }} />
        </div>
        <p className="mt-2 text-xs text-[#6B6B6B]">
          Progress {pct}% · sisa {m?.remaining || 0} botol · omzet {rp(m?.omzet || 0)}
        </p>
      </div>
      <p className="rounded-2xl border border-[#E8E8E4] bg-white px-4 py-3 text-sm text-[#6B6B6B]">
        Bonus mengikuti aturan komisi yang diatur owner di dashboard Gercep OS (Sales → Komisi). Portal ini menampilkan progress target real dari transaksi lunas.
      </p>
    </div>
  );
}
