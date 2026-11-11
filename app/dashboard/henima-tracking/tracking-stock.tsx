"use client";

import { useState, type ReactNode } from "react";
import { Package, Users, Wallet, ShoppingBag } from "lucide-react";
import { type OwnerDashboardSummary, pctChange } from "@/lib/henima-tracking/owner-dashboard";

const GOLD = "#C5A358";

type Product = { id: string; name: string; stock: number };
type Staff = { id: string; nama: string };
type Hand = {
  salesId: string;
  salesName: string;
  productId: string;
  productName: string;
  qty: number;
  warehouseStock: number;
};
type Issue = {
  id: string;
  salesName: string;
  productName: string;
  qty: number;
  direction: "issue" | "return";
  note: string | null;
  createdAt: string;
};

function rp(n: number) {
  return `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
}

function initials(nama: string) {
  return (
    nama
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

function productTone(name: string) {
  const n = name.toLowerCase();
  if (n.includes("afternoon")) return "bg-[#111] text-white";
  if (n.includes("distance")) return "bg-white text-[#111] border border-[#E8E8E4]";
  return "bg-[#F7F4EC] text-[#8A7040]";
}

export default function TrackingStock({
  ownerName,
  summary,
  salesAktif,
  salesOnline,
  salesTotal,
  canEdit,
  hand: initialHand,
  issues: initialIssues,
  products,
  staff,
}: {
  ownerName: string;
  summary?: OwnerDashboardSummary | null;
  salesAktif: number;
  salesOnline: number;
  salesTotal: number;
  canEdit: boolean;
  hand: Hand[];
  issues: Issue[];
  products: Product[];
  staff: Staff[];
}) {
  const [hand, setHand] = useState(initialHand);
  const [issues, setIssues] = useState(initialIssues);
  const [warehouse, setWarehouse] = useState(products);
  const [salesId, setSalesId] = useState(staff[0]?.id || "");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [qty, setQty] = useState("5");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const omzetDelta = summary ? pctChange(summary.omzetBulan, summary.omzetBulanLalu) : 0;
  const botolDelta = summary ? pctChange(summary.botolBulan, summary.botolBulanLalu) : 0;
  const trxDelta = summary ? pctChange(summary.transaksiBulan, summary.transaksiBulanLalu) : 0;

  async function submit(action: "issue" | "return") {
    setBusy(true);
    setError("");
    setOkMsg("");
    try {
      const res = await fetch("/api/sales/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          salesId,
          productId,
          qty: Number(qty),
          note: note.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan.");
      setHand(json.hand || []);
      setIssues(json.issues || []);
      if (json.result?.warehouseStock != null) {
        setWarehouse((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, stock: Number(json.result.warehouseStock) } : p)),
        );
      }
      setOkMsg(
        action === "issue"
          ? `Ambil ${qty} pcs ke tangan sales. Gudang sisa ${json.result?.warehouseStock ?? "—"}.`
          : `Kembali ${qty} pcs ke gudang. Gudang sekarang ${json.result?.warehouseStock ?? "—"}.`,
      );
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#111] md:text-[30px]">
            Selamat datang, {ownerName}
          </h1>
          <p className="mt-1 text-sm text-[#6B6B6B]">Pantau transfer stok dari gudang ke tangan sales.</p>
        </div>
        <aside className="relative overflow-hidden rounded-2xl border border-[#E8D9A8] bg-[#F7F4EC] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>
            HENIMA
          </p>
          <p className="mt-1 text-sm font-bold text-[#111]">Grow Together, Achieve More</p>
          <p className="mt-0.5 text-xs text-[#6B6B6B]">{summary?.monthLabel || "Bulan berjalan"}</p>
        </aside>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          icon={Wallet}
          label="Omzet bulan ini"
          value={rp(summary?.omzetBulan || 0)}
          footer={
            <span className={`text-xs font-semibold ${omzetDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {omzetDelta >= 0 ? "+" : "−"}
              {Math.abs(omzetDelta)}% vs bulan lalu
            </span>
          }
        />
        <Metric
          icon={Package}
          label="Produk terjual"
          value={`${summary?.botolBulan || 0} pcs`}
          footer={
            <span className={`text-xs font-semibold ${botolDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {botolDelta >= 0 ? "+" : "−"}
              {Math.abs(botolDelta)}% vs bulan lalu
            </span>
          }
        />
        <Metric
          icon={ShoppingBag}
          label="Total transaksi"
          value={`${summary?.transaksiBulan || 0}`}
          footer={
            <span className={`text-xs font-semibold ${trxDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {trxDelta >= 0 ? "+" : "−"}
              {Math.abs(trxDelta)}% vs bulan lalu
            </span>
          }
        />
        <Metric
          icon={Users}
          label="Sales aktif"
          value={`${salesAktif} dari ${salesTotal || salesAktif}`}
          footer={
            <span className="text-xs font-semibold text-[#6B6B6B]">
              Online: <span style={{ color: GOLD }}>{salesOnline}</span>
            </span>
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-[0_8px_24px_rgba(17,17,17,0.04)]">
          <h2 className="text-sm font-bold text-[#111]">Stok gudang</h2>
          <p className="mt-1 text-xs text-[#6B6B6B]">Berkurang saat sales ambil barang</p>
          <ul className="mt-4 space-y-3">
            {warehouse.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-3">
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold ${productTone(p.name)}`}
                >
                  {p.name.slice(0, 3).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold uppercase tracking-wide text-[#111]">{p.name}</p>
                  <p className="text-xs text-[#6B6B6B]">Gudang</p>
                </div>
                <p className="text-base font-bold tabular-nums" style={{ color: GOLD }}>
                  {p.stock} pcs
                </p>
              </li>
            ))}
            {!warehouse.length && <p className="text-sm text-[#6B6B6B]">Belum ada produk katalog.</p>}
          </ul>
        </section>

        <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-[0_8px_24px_rgba(17,17,17,0.04)]">
          <h2 className="text-sm font-bold text-[#111]">Ambil / kembalikan</h2>
          <p className="mt-1 text-xs text-[#6B6B6B]">Catat barang yang dibawa sales dari gudang</p>
          {canEdit ? (
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-[#6B6B6B]">
                Sales
                <select
                  className="mt-1 w-full rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-2.5 text-sm text-[#111]"
                  value={salesId}
                  onChange={(e) => setSalesId(e.target.value)}
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-[#6B6B6B]">
                Produk
                <select
                  className="mt-1 w-full rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-2.5 text-sm text-[#111]"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (gudang {warehouse.find((w) => w.id === p.id)?.stock ?? p.stock})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-[#6B6B6B]">
                Jumlah
                <input
                  className="mt-1 w-full rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-2.5 text-sm text-[#111]"
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold text-[#6B6B6B]">
                Catatan
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-2.5 text-sm text-[#111]"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Opsional"
                />
              </label>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy || !salesId || !productId}
                  onClick={() => void submit("issue")}
                  className="rounded-xl py-3 text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: GOLD }}
                >
                  {busy ? "Menyimpan…" : "Ambil dari gudang"}
                </button>
                <button
                  type="button"
                  disabled={busy || !salesId || !productId}
                  onClick={() => void submit("return")}
                  className="rounded-xl border-2 py-3 text-sm font-bold disabled:opacity-40"
                  style={{ borderColor: GOLD, color: GOLD }}
                >
                  Kembalikan ke gudang
                </button>
              </div>
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              {okMsg ? <p className="text-sm text-emerald-700">{okMsg}</p> : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#6B6B6B]">Hanya owner/leader yang mencatat ambil gudang.</p>
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-[0_8px_24px_rgba(17,17,17,0.04)]">
            <h2 className="text-sm font-bold text-[#111]">Stok di tangan sales</h2>
            <ul className="mt-3 space-y-2.5">
              {hand.map((row) => (
                <li
                  key={`${row.salesId}-${row.productId}`}
                  className="flex items-center gap-3 rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-2.5"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: GOLD }}
                  >
                    {initials(row.salesName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#111]">{row.salesName}</p>
                    <p className="truncate text-[11px] text-[#6B6B6B]">{row.productName}</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums" style={{ color: GOLD }}>
                    {row.qty} pcs
                  </p>
                </li>
              ))}
              {!hand.length && (
                <p className="text-sm text-[#6B6B6B]">Belum ada barang di tangan. Catat ambil dari gudang dulu.</p>
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-[0_8px_24px_rgba(17,17,17,0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#111]">Riwayat ambil / kembali</h2>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Live</span>
            </div>
            <ul className="space-y-3">
              {issues.slice(0, 8).map((row) => (
                <li key={row.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: GOLD }} />
                  <div className="min-w-0">
                    <p className="text-sm leading-snug text-[#111]">
                      {row.salesName} {row.direction === "issue" ? "mengambil" : "mengembalikan"} {row.qty} pcs{" "}
                      {row.productName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#8A8A8A]">
                      {new Intl.DateTimeFormat("id-ID", {
                        timeZone: "Asia/Jakarta",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(row.createdAt))}
                      {row.note ? ` · ${row.note}` : ""}
                    </p>
                  </div>
                </li>
              ))}
              {!issues.length && <p className="text-sm text-[#6B6B6B]">Belum ada riwayat.</p>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  footer,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  footer: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-[0_8px_24px_rgba(17,17,17,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8A8A]">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F7F4EC]">
          <Icon size={15} color={GOLD} />
        </span>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums text-[#111]">{value}</p>
      <div className="mt-2">{footer}</div>
    </div>
  );
}
