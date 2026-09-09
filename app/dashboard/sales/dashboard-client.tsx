"use client";
import Link from "next/link";
import { useState } from "react";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../components/module-form-styles";
import { fmtDateId, fmtRp } from "@/lib/henima-sales/money";
import type { ReportKind } from "@/lib/henima-sales/report-service";

type Report = {
  range: { from: string; to: string; label: string };
  scopeLabel?: string;
  totalOrders: number;
  totalQty: number;
  totalRevenue: number;
  aov: number;
  cashTotal?: number;
  transferTotal?: number;
  qrisTotal?: number;
  hppTotal?: number;
  profitTotal?: number;
  newCustomers: number;
  repeatCustomers: number;
  byProduct: { name: string; qty: number; omzet: number }[];
  ranking: { salesId: string; nama: string; qty: number; revenue: number; count: number }[];
  servedBy?: { salesId: string; nama: string; qty: number; revenue: number; count: number }[];
  lines?: {
    date: string;
    customerName: string;
    salesName: string;
    note: string;
    qty: number;
    cash: number;
    transfer: number;
    qris: number;
    hpp: number;
    profit: number;
  }[];
};

type Staff = {
  id: string;
  nama: string;
  role: string;
  status: string;
  telegram_user_id: number | null;
};

type Follow = { id: string; customerId: string; nama: string; lastPurchase: string | null };

const PERIODS: { id: ReportKind; label: string }[] = [
  { id: "today", label: "Hari ini" },
  { id: "yesterday", label: "Kemarin" },
  { id: "this_week", label: "Minggu ini" },
  { id: "this_month", label: "Bulan ini" },
  { id: "last_month", label: "Bulan lalu" },
  { id: "this_year", label: "Tahun ini" },
  { id: "all", label: "Semua" },
  { id: "custom", label: "Pilih tanggal" },
];

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className={MODULE_CARD}>
      <p className="text-[10px] uppercase tracking-wide text-[#8B8AA0]">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-[#F0EFF8]">{value}</p>
    </div>
  );
}

function telegramLabel(s: Staff) {
  if (s.status === "disabled") return "Diputus";
  if (s.telegram_user_id) return "CONNECTED";
  return "Belum aktif";
}

export default function DashboardClient({
  initialKind = "this_month",
  initial,
  staff,
  follow,
}: {
  initialKind?: ReportKind;
  initial: Report;
  staff: Staff[];
  follow: Follow[];
}) {
  const [kind, setKind] = useState<ReportKind>(initialKind);
  const [from, setFrom] = useState(initial.range.from);
  const [to, setTo] = useState(initial.range.to);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);

  const query = (nextKind = kind, nextFrom = from, nextTo = to) => {
    const qs = new URLSearchParams({ kind: nextKind });
    if (nextKind === "custom") {
      if (nextFrom) qs.set("from", nextFrom);
      if (nextTo) qs.set("to", nextTo);
    }
    return qs;
  };

  const load = async (nextKind = kind, nextFrom = from, nextTo = to) => {
    setLoading(true);
    const res = await fetch("/api/reports/sales?" + query(nextKind, nextFrom, nextTo).toString());
    const json = await res.json();
    if (res.ok) setData(json);
    setLoading(false);
  };

  const pick = (next: ReportKind) => {
    setKind(next);
    if (next !== "custom") void load(next);
  };

  const download = async (format: "pdf" | "csv") => {
    setBusy(format);
    const res = await fetch("/api/reports/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, from, to, format }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      format === "csv"
        ? `henima-rekap-${data.range.from}-${data.range.to}.csv`
        : `henima-rekap-${data.range.from}-${data.range.to}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setBusy(null);
  };

  const lines = [...(data.lines || [])].reverse().slice(0, 12);
  const active = staff.filter((s) => s.status === "active").length;
  const connected = staff.filter((s) => s.status === "active" && s.telegram_user_id).length;

  return (
    <>
      <div className={MODULE_CARD + " mb-4"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Pantau penjualan</p>
            <p className="mt-1 text-xs text-[#8B8AA0]">
              {data.scopeLabel || "Omzet perusahaan"} · {data.range.label} · {data.range.from} – {data.range.to}
              {loading ? " · memuat…" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => download("pdf")} disabled={!!busy} className={MODULE_BTN}>
              {busy === "pdf" ? "Menyiapkan PDF…" : "Unduh PDF"}
            </button>
            <button type="button" onClick={() => download("csv")} disabled={!!busy} className={MODULE_BTN}>
              {busy === "csv" ? "Menyiapkan CSV…" : "Unduh CSV"}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p.id)}
              className={
                "rounded-lg border px-3 py-1.5 text-xs font-medium " +
                (kind === p.id
                  ? "border-[#2DD4BF]/50 bg-[#2DD4BF]/15 text-[#2DD4BF]"
                  : "border-white/10 text-[#8B8AA0] hover:text-[#F0EFF8]")
              }
            >
              {p.label}
            </button>
          ))}
        </div>
        {kind === "custom" && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-[#8B8AA0]">
              Dari
              <input type="date" className={MODULE_INPUT + " mt-1 max-w-[160px]"} value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="text-xs text-[#8B8AA0]">
              Sampai
              <input type="date" className={MODULE_INPUT + " mt-1 max-w-[160px]"} value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button type="button" onClick={() => load("custom", from, to)} disabled={loading} className={MODULE_BTN}>
              Terapkan tanggal
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total penjualan" value={fmtRp(data.totalRevenue)} />
        <Kpi label="Total pcs" value={String(data.totalQty)} />
        <Kpi label="Total transaksi" value={String(data.totalOrders)} />
        <Kpi label="AOV" value={fmtRp(data.aov)} />
        <Kpi label="HPP" value={fmtRp(data.hppTotal || 0)} />
        <Kpi label="Profit" value={fmtRp(data.profitTotal || 0)} />
        <Kpi label="Cash" value={fmtRp(data.cashTotal || 0)} />
        <Kpi label="Transfer" value={fmtRp(data.transferTotal || 0)} />
        <Kpi label="QRIS" value={fmtRp(data.qrisTotal || 0)} />
        <Kpi label="Customer baru" value={String(data.newCustomers)} />
        <Kpi label="Customer repeat" value={String(data.repeatCustomers)} />
        <Kpi label="Sales aktif / Telegram" value={`${active} / ${connected}`} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className={MODULE_CARD}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Tim & aplikasi Telegram</h2>
            <Link href="/dashboard/sales/team" className="text-[11px] text-[#2DD4BF]">
              Kelola akses
            </Link>
          </div>
          {staff.length === 0 ? (
            <p className="text-sm text-[#8B8AA0]">Belum ada anggota tim.</p>
          ) : (
            <ul className="space-y-2">
              {staff.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {s.nama}
                    <span className="ml-2 text-[11px] text-[#8B8AA0]">{s.role}</span>
                  </span>
                  <span
                    className={
                      "text-[11px] font-medium " +
                      (s.status === "disabled"
                        ? "text-[#F59E0B]"
                        : s.telegram_user_id
                          ? "text-[#2DD4BF]"
                          : "text-[#8B8AA0]")
                    }
                  >
                    {telegramLabel(s)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={MODULE_CARD}>
          <h2 className="mb-3 text-sm font-semibold">Ranking sales</h2>
          {data.ranking.length === 0 ? (
            <p className="text-sm text-[#8B8AA0]">
              {(data.servedBy || []).length
                ? `Dilayani oleh ${(data.servedBy || []).map((s) => s.nama).join(", ")}`
                : "Belum ada penjualan pada periode ini."}
            </p>
          ) : (
            <ol className="space-y-2">
              {data.ranking.map((s, i) => (
                <li key={s.salesId} className="flex justify-between text-sm">
                  <span>
                    {i + 1}. {s.nama}
                  </span>
                  <span className="font-mono text-[#2DD4BF]">
                    {s.qty} pcs · {fmtRp(s.revenue)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {(data.servedBy || []).length > 0 && (
            <p className="mt-3 text-sm text-[#8B8AA0]">
              Dilayani oleh {(data.servedBy || []).map((s) => s.nama).join(", ")}
            </p>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className={MODULE_CARD}>
          <h2 className="mb-3 text-sm font-semibold">Produk</h2>
          {data.byProduct.length === 0 ? (
            <p className="text-sm text-[#8B8AA0]">Belum ada produk terjual pada periode ini.</p>
          ) : (
            <ul className="space-y-2">
              {data.byProduct.map((p) => (
                <li key={p.name} className="flex justify-between text-sm">
                  <span>{p.name}</span>
                  <span className="font-mono">
                    {p.qty} pcs · {fmtRp(p.omzet)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={MODULE_CARD}>
          <h2 className="mb-3 text-sm font-semibold">Follow up hari ini</h2>
          {follow.length === 0 ? (
            <p className="text-sm text-[#8B8AA0]">Tidak ada follow-up hari ini.</p>
          ) : (
            <ul className="space-y-3">
              {follow.map((f) => (
                <li key={f.id} className="text-sm">
                  <p className="font-medium">{f.nama}</p>
                  <p className="text-[11px] text-[#8B8AA0]">Pembelian terakhir: {f.lastPurchase || "—"}</p>
                  <Link href={`/dashboard/sales/customers/${f.customerId}`} className="text-[11px] text-[#2DD4BF]">
                    DETAIL
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={MODULE_CARD}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Transaksi periode ini</h2>
          <Link href="/dashboard/sales/orders" className="text-[11px] text-[#2DD4BF]">
            Semua order
          </Link>
        </div>
        {lines.length === 0 ? (
          <p className="text-sm text-[#8B8AA0]">Belum ada transaksi pada periode ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="text-[#8B8AA0]">
                <tr>
                  <th className="pb-2 font-medium">Tanggal</th>
                  <th className="pb-2 font-medium">Nama</th>
                  <th className="pb-2 font-medium">Keterangan</th>
                  <th className="pb-2 font-medium">Qty</th>
                  <th className="pb-2 font-medium">Omzet</th>
                  <th className="pb-2 font-medium">HPP</th>
                  <th className="pb-2 font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={`${l.date}-${l.customerName}-${i}`} className="border-t border-white/5">
                    <td className="py-2">{fmtDateId(l.date)}</td>
                    <td className="py-2">{l.customerName}</td>
                    <td className="py-2 text-[#8B8AA0]">{l.note}</td>
                    <td className="py-2 font-mono">{l.qty}</td>
                    <td className="py-2 font-mono">{fmtRp(l.cash + l.transfer + l.qris)}</td>
                    <td className="py-2 font-mono">{fmtRp(l.hpp)}</td>
                    <td className="py-2 font-mono text-[#2DD4BF]">{fmtRp(l.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
