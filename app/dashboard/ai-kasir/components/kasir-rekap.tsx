"use client";
import { useMemo } from "react";
import { BarChart3, DollarSign, ShoppingCart, Clock, TrendingUp } from "lucide-react";
import type { TodaySale, KasirShift } from "../page";

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }

export default function KasirRekap({
  todaySales, todayShifts, omzetHariIni, totalOrder, today,
}: {
  todaySales: TodaySale[]; todayShifts: KasirShift[];
  omzetHariIni: number; totalOrder: number; today: string;
}) {
  const avgPerOrder = totalOrder > 0 ? omzetHariIni / totalOrder : 0;

  const perJam = useMemo(() => {
    const map: Record<number, { count: number; total: number }> = {};
    for (let h = 0; h < 24; h++) map[h] = { count: 0, total: 0 };
    todaySales.forEach((t) => {
      const h = new Date(t.created_at).getHours();
      map[h].count++;
      map[h].total += Number(t.total);
    });
    return Object.entries(map)
      .map(([h, v]) => ({ hour: Number(h), ...v }))
      .filter((v) => v.count > 0 || (Number(v.hour) >= 6 && Number(v.hour) <= 22));
  }, [todaySales]);

  const maxTotal = Math.max(...perJam.map((p) => p.total), 1);
  const totalShiftOmzet = todayShifts.reduce((s, sh) => s + Number(sh.total_transaksi), 0);
  const totalShiftOrders = todayShifts.reduce((s, sh) => s + Number(sh.total_order), 0);

  const card = "rounded-2xl border border-[#C5D4CB] bg-white p-4 shadow-sm";

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Omzet hari ini", value: fmtRp(omzetHariIni), color: "#007A4D", icon: DollarSign },
          { label: "Total order", value: String(totalOrder), color: "#0F1F17", icon: ShoppingCart },
          { label: "Rata² / order", value: fmtRp(avgPerOrder), color: "#B45309", icon: TrendingUp },
          { label: "Shift hari ini", value: String(todayShifts.length), color: "#1D4ED8", icon: Clock },
        ].map((k) => (
          <div key={k.label} className={card}>
            <div className="mb-2 flex items-center gap-1.5">
              <k.icon size={12} style={{ color: k.color }} />
              <p className="text-[10px] uppercase tracking-wide text-[#5C6B63]">{k.label}</p>
            </div>
            <p className="text-lg font-bold font-mono" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className={"mb-5 " + card}>
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 size={14} className="text-[#007A4D]" />
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5C6B63]">Penjualan per jam — {today}</p>
        </div>
        {perJam.every((p) => p.count === 0) ? (
          <p className="py-6 text-center text-xs text-[#5C6B63]">Belum ada penjualan AI Kasir hari ini</p>
        ) : (
          <div className="flex items-end gap-1 sm:gap-1.5" style={{ height: 140 }}>
            {perJam.map((p) => {
              const pct = (p.total / maxTotal) * 100;
              return (
                <div key={p.hour} className="flex flex-1 flex-col items-center gap-1">
                  <div className="relative flex w-full flex-col items-center" style={{ height: 110 }}>
                    {p.count > 0 && (
                      <span className="mb-1 font-mono text-[8px] text-[#5C6B63]">{p.count}</span>
                    )}
                    <div
                      className="w-full max-w-[24px] rounded-t-md"
                      style={{
                        height: `${Math.max(pct, p.count > 0 ? 8 : 0)}%`,
                        background: p.count > 0 ? "#007A4D" : "transparent",
                        marginTop: "auto",
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-[#5C6B63]">{String(p.hour).padStart(2, "0")}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {todayShifts.length > 0 && (
        <div className={"mb-5 " + card}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#5C6B63]">Ringkasan shift</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-[#F2F6F4] p-3 text-center">
              <p className="text-[9px] uppercase text-[#5C6B63]">Shift</p>
              <p className="font-mono text-lg font-bold text-[#1D4ED8]">{todayShifts.length}</p>
            </div>
            <div className="rounded-xl bg-[#F2F6F4] p-3 text-center">
              <p className="text-[9px] uppercase text-[#5C6B63]">Omzet shift</p>
              <p className="font-mono text-sm font-bold text-[#007A4D]">{fmtRp(totalShiftOmzet)}</p>
            </div>
            <div className="rounded-xl bg-[#F2F6F4] p-3 text-center">
              <p className="text-[9px] uppercase text-[#5C6B63]">Order shift</p>
              <p className="font-mono text-lg font-bold text-[#0F1F17]">{totalShiftOrders}</p>
            </div>
          </div>
        </div>
      )}

      {todaySales.length > 0 && (
        <div className={card}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#5C6B63]">Riwayat AI Kasir hari ini</p>
          <div className="max-h-[300px] space-y-1.5 overflow-y-auto scrollbar-none">
            {todaySales.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl bg-[#F7FAF8] px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-[#0F1F17]">{t.catatan || "Penjualan"}</p>
                  <p className="font-mono text-[9px] text-[#5C6B63]">
                    {new Date(t.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    {t.metode_bayar ? ` · ${t.metode_bayar}` : ""}
                  </p>
                </div>
                <p className="font-mono text-xs font-semibold text-[#007A4D]">+{fmtRp(Number(t.total))}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
