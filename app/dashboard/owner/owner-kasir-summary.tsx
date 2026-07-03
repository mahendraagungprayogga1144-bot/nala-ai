import Link from "next/link";
import { formatTxTimeWib } from "@/lib/finance/sort-transactions";
import { shortOrderNo } from "@/app/dashboard/fnb/lib/receipt-thermal";
import OwnerDayCloseBar from "./owner-day-close-bar";
import type { DayCloseData } from "@/app/dashboard/fnb/lib/day-close-report";

export type KasirRecentOrder = {
  id: string;
  total: number;
  created_at: string;
  kasirName: string;
  itemsSummary: string;
  mejaLabel?: string | null;
  catatan?: string | null;
};

export type KasirTodaySummary = {
  omzetHariIni: number;
  labaHariIni: number;
  orderHariIni: number;
  recentOrders: KasirRecentOrder[];
};

export default function OwnerKasirSummary({
  summary,
  businessName,
  dayCloseData,
}: {
  summary: KasirTodaySummary;
  businessName?: string;
  dayCloseData?: DayCloseData | null;
}) {
  return (
    <div className="dashboard-card dashboard-card-hover mb-4 overflow-hidden p-0">
      <div className="h-[2px] bg-gradient-to-r from-transparent via-[#2DD4BF]/60 to-transparent" />
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div>
            <h2 className="dash-card-title">Kasir Hari Ini</h2>
            {businessName && <p className="text-[10px] text-slate-500">{businessName}</p>}
          </div>
          <Link href="/dashboard/ai-kasir" className="dash-card-link">Buka Kasir</Link>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { l: "Omzet", v: summary.omzetHariIni, c: "#2DD4BF" },
            { l: "Order", v: summary.orderHariIni, c: "#A78BFA", raw: true },
            { l: "Laba", v: summary.labaHariIni, c: "#FBBF24" },
          ].map(k => (
            <div key={k.l} className="rounded-xl border border-white/[0.08] bg-[#0b0e14]/80 px-2 py-2.5 text-center">
              <p className="text-[9px] uppercase tracking-wide text-slate-500">{k.l}</p>
              <p className="mt-0.5 font-mono text-sm font-bold" style={{ color: k.c }}>
                {k.raw ? String(k.v) : "Rp" + Number(k.v).toLocaleString("id-ID")}
              </p>
            </div>
          ))}
        </div>

        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Order terakhir</p>
        {summary.recentOrders.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-600">Belum ada order hari ini</p>
        ) : (
          <div className="flex flex-col gap-2">
            {summary.recentOrders.map(o => (
              <div key={o.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0b0e14]/50 px-3 py-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2DD4BF]/15 text-[10px] font-bold text-[#2DD4BF]">
                  {o.kasirName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <p className="truncate text-sm font-medium text-slate-200">{o.itemsSummary || "Order"}</p>
                    {o.mejaLabel && (
                      <span className="shrink-0 rounded-md bg-[#F59E0B]/15 px-1.5 py-0.5 text-[9px] font-medium text-[#F59E0B]">
                        {o.mejaLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {o.kasirName} · {shortOrderNo(o.id)} · {formatTxTimeWib(o.created_at)} WIB
                    {o.catatan ? ` · ${o.catatan}` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm font-semibold text-[#2DD4BF]">
                  Rp{o.total.toLocaleString("id-ID")}
                </p>
              </div>
            ))}
          </div>
        )}

        <Link
          href="/dashboard/keuangan-bisnis"
          className="mt-3 flex w-full items-center justify-center rounded-xl border border-[#2DD4BF]/25 bg-[#2DD4BF]/10 py-2 text-xs font-medium text-[#2DD4BF] hover:bg-[#2DD4BF]/15"
        >
          Lihat semua transaksi kasir →
        </Link>

        {dayCloseData && <OwnerDayCloseBar data={dayCloseData} />}
      </div>
    </div>
  );
}
