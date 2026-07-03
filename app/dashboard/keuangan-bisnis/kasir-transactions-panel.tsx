"use client";
import { useMemo, useState } from "react";
import { formatTxDateLabel, formatTxTimeWib } from "@/lib/finance/sort-transactions";
import { shortOrderNo } from "@/app/dashboard/fnb/lib/receipt-thermal";
import { KASIR } from "@/app/dashboard/fnb/lib/kasir-theme";
import { parseMejaFromCatatan, mejaLabel } from "@/app/dashboard/fnb/lib/kasir-order-meta";
import KasirExportBar from "./components/kasir-export-bar";
import type { KasirExportOrder } from "./lib/kasir-export-types";

export type KasirOrderRow = {
  id: string;
  user_id: string;
  kasirName: string;
  total: number;
  diskon: number | null;
  laba: number | null;
  metode_bayar: string | null;
  catatan: string | null;
  order_date: string;
  created_at: string;
  order_items: {
    qty: number;
    harga_jual: number;
    menus: { nama: string } | { nama: string }[] | null;
  }[];
};

const METODE: Record<string, string> = { tunai: "Tunai", qris: "QRIS", transfer: "Transfer" };

function menuName(m: KasirOrderRow["order_items"][0]["menus"]): string {
  if (!m) return "Menu";
  if (Array.isArray(m)) return m[0]?.nama || "Menu";
  return m.nama;
}

function itemsSummary(o: KasirOrderRow): string {
  return (o.order_items || []).map(i => `${menuName(i.menus)} x${i.qty}`).join(", ");
}

function toExportOrder(o: KasirOrderRow): KasirExportOrder {
  return {
    id: o.id,
    orderNo: shortOrderNo(o.id),
    kasirName: o.kasirName,
    order_date: o.order_date,
    created_at: o.created_at,
    metode_bayar: o.metode_bayar,
    catatan: o.catatan,
    diskon: o.diskon,
    total: Number(o.total),
    laba: o.laba,
    itemsSummary: itemsSummary(o),
  };
}

export default function KasirTransactionsPanel({
  orders,
  monthLabel,
  businessName,
}: {
  orders: KasirOrderRow[];
  monthLabel: string;
  businessName: string;
}) {
  const [kasirFilter, setKasirFilter] = useState("semua");

  const kasirList = useMemo(() => {
    const names = Array.from(new Set(orders.map(o => o.kasirName))).sort();
    return names;
  }, [orders]);

  const filtered = useMemo(() => {
    if (kasirFilter === "semua") return orders;
    return orders.filter(o => o.kasirName === kasirFilter);
  }, [orders, kasirFilter]);

  const exportOrders = useMemo(() => filtered.map(toExportOrder), [filtered]);

  const totalOrders = filtered.length;
  const omzet = filtered.reduce((s, o) => s + Number(o.total || 0), 0);
  const laba = filtered.reduce((s, o) => s + Number(o.laba || 0), 0);

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-[#2DD4BF]/25 bg-[#13131F]/95 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
      <div className="h-[2px]" style={{ background: KASIR.gradient.headerLine }} />
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#2DD4BF]">Transaksi Kasir</p>
          <p className="text-xs text-[#A8A7C0]">Order dari kasir & link karyawan · {monthLabel}</p>
        </div>
        <KasirExportBar orders={exportOrders} ctx={{ businessName, periodLabel: monthLabel }} />
      </div>

      {kasirList.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-4 py-2.5 scrollbar-none sm:px-5">
          <button
            type="button"
            onClick={() => setKasirFilter("semua")}
            className={"shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium " + (kasirFilter === "semua" ? "border-[#2DD4BF]/50 bg-[#2DD4BF]/15 text-[#2DD4BF]" : "border-white/10 text-[#5E5D78]")}
          >
            Semua kasir
          </button>
          {kasirList.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => setKasirFilter(name)}
              className={"shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium " + (kasirFilter === name ? "border-[#2DD4BF]/50 bg-[#2DD4BF]/15 text-[#2DD4BF]" : "border-white/10 text-[#5E5D78]")}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-px border-b border-white/10 bg-white/5">
        {[
          { label: "Total order", value: String(totalOrders), kpi: KASIR.gradient.kpi.order },
          { label: "Omzet kasir", value: "Rp" + omzet.toLocaleString("id-ID"), kpi: KASIR.gradient.kpi.omzet },
          { label: "Laba kasir", value: "Rp" + Math.round(laba).toLocaleString("id-ID"), kpi: KASIR.gradient.kpi.laba },
        ].map(k => (
          <div key={k.label} className="px-3 py-3 text-center sm:px-4" style={{ background: k.kpi.bg }}>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[#A8A7C0]">{k.label}</p>
            <p className="mt-0.5 font-mono text-sm font-bold sm:text-base" style={{ color: k.kpi.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="max-h-[420px] overflow-y-auto p-4 sm:p-5">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#8B8AA0]">Belum ada transaksi kasir di periode ini.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(o => {
              const summary = itemsSummary(o);
              const parsed = parseMejaFromCatatan(o.catatan);
              const meja = mejaLabel(parsed.meja);
              return (
                <div key={o.id} className="rounded-xl border border-white/[0.08] bg-[#0A0A14]/80 px-3 py-3 sm:px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-[#2DD4BF]/15 px-1.5 py-0.5 text-[9px] font-medium text-[#2DD4BF]">Kasir</span>
                        <span className="rounded-md bg-[#A78BFA]/15 px-1.5 py-0.5 text-[9px] font-medium text-[#A78BFA]">{o.kasirName}</span>
                        {meja && (
                          <span className="rounded-md bg-[#F59E0B]/15 px-1.5 py-0.5 text-[9px] font-medium text-[#F59E0B]">{meja}</span>
                        )}
                        <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-[#8B8AA0]">
                          {METODE[o.metode_bayar || ""] || o.metode_bayar || "—"}
                        </span>
                        <span className="font-mono text-[9px] text-[#5E5D78]">{shortOrderNo(o.id)}</span>
                      </div>
                      <p className="mt-1 truncate text-sm text-[#FAFAFE]">{summary || "Order"}</p>
                      <p className="mt-0.5 text-[10px] text-[#8B8AA0]">
                        {formatTxDateLabel(o.order_date)} · {formatTxTimeWib(o.created_at)} WIB
                        {parsed.note ? ` · ${parsed.note}` : !meja && o.catatan ? ` · ${o.catatan}` : ""}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold text-[#2DD4BF]">
                        Rp{Number(o.total).toLocaleString("id-ID")}
                      </p>
                      {o.laba != null && (
                        <p className="text-[10px] text-[#5A5B7A]">Laba Rp{Math.round(Number(o.laba)).toLocaleString("id-ID")}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
