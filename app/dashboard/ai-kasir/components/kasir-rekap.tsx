"use client";
import { useMemo } from "react";
import { BarChart3, DollarSign, ShoppingCart, Clock, TrendingUp } from "lucide-react";
import type { TodayTx, KasirShift } from "../page";

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }

export default function KasirRekap({
  todayTransactions, todayShifts, omzetHariIni, totalOrder, today,
}: {
  todayTransactions: TodayTx[]; todayShifts: KasirShift[];
  omzetHariIni: number; totalOrder: number; today: string;
}) {
  const avgPerOrder = totalOrder > 0 ? omzetHariIni / totalOrder : 0;

  const perJam = useMemo(() => {
    const map: Record<number, { count: number; total: number }> = {};
    for (let h = 0; h < 24; h++) map[h] = { count: 0, total: 0 };
    todayTransactions.forEach(t => {
      const h = new Date(t.created_at).getHours();
      map[h].count++;
      map[h].total += Number(t.amount);
    });
    return Object.entries(map)
      .map(([h, v]) => ({ hour: Number(h), ...v }))
      .filter(v => v.count > 0 || (Number(v.hour) >= 6 && Number(v.hour) <= 22));
  }, [todayTransactions]);

  const maxTotal = Math.max(...perJam.map(p => p.total), 1);

  const topProducts = useMemo(() => {
    const map: Record<string, { qty: number; total: number }> = {};
    todayTransactions.forEach(t => {
      const desc = t.description || "Lainnya";
      const parts = desc.split(", ");
      parts.forEach(part => {
        const match = part.match(/^(.+?)\s+x(\d+)$/);
        if (match) {
          const name = match[1];
          const qty = Number(match[2]);
          if (!map[name]) map[name] = { qty: 0, total: 0 };
          map[name].qty += qty;
        }
      });
      if (!map[desc]) map[desc] = { qty: 0, total: 0 };
      map[desc].total += Number(t.amount);
    });
    return Object.entries(map)
      .filter(([, v]) => v.qty > 0)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 10);
  }, [todayTransactions]);

  const totalShiftOmzet = todayShifts.reduce((s, sh) => s + Number(sh.total_transaksi), 0);
  const totalShiftOrders = todayShifts.reduce((s, sh) => s + Number(sh.total_order), 0);

  return (
    <div>
      {/* KPI */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Omzet Hari Ini", value: fmtRp(omzetHariIni), color: "#2DD4BF", icon: DollarSign },
          { label: "Total Order", value: String(totalOrder), color: "#8B5CF6", icon: ShoppingCart },
          { label: "Rata² per Order", value: fmtRp(avgPerOrder), color: "#F59E0B", icon: TrendingUp },
          { label: "Shift Hari Ini", value: String(todayShifts.length), color: "#38BDF8", icon: Clock },
        ].map(k => (
          <div key={k.label} className="rounded-2xl border p-4" style={{ borderColor: k.color + "33", background: "#0D0D1A" }}>
            <div className="mb-2 flex items-center gap-1.5">
              <k.icon size={12} style={{ color: k.color }} />
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-[#8B8AA0]">{k.label}</p>
            </div>
            <p className="text-lg font-bold" style={{ color: k.color, fontFamily: "'JetBrains Mono', monospace" }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Transaksi per jam chart */}
      <div className="mb-5 rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 size={14} className="text-[#2DD4BF]" />
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Transaksi per Jam — {today}</p>
        </div>
        {perJam.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#3A3B52]">Belum ada transaksi hari ini</p>
        ) : (
          <div className="flex items-end gap-1 sm:gap-1.5" style={{ height: 140 }}>
            {perJam.map(p => {
              const pct = (p.total / maxTotal) * 100;
              return (
                <div key={p.hour} className="flex flex-1 flex-col items-center gap-1">
                  <div className="relative w-full flex flex-col items-center" style={{ height: 110 }}>
                    {p.count > 0 && (
                      <span className="mb-1 text-[8px] font-mono text-[#8B8AA0]">{p.count}</span>
                    )}
                    <div className="w-full max-w-[24px] rounded-t-lg transition-all duration-300"
                      style={{
                        height: `${Math.max(pct, p.count > 0 ? 8 : 0)}%`,
                        background: p.count > 0 ? "linear-gradient(180deg, #2DD4BF, #8B5CF6)" : "transparent",
                        marginTop: "auto",
                      }} />
                  </div>
                  <span className="text-[9px] text-[#5A5B7A]">{String(p.hour).padStart(2, "0")}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Produk terlaris */}
      {topProducts.length > 0 && (
        <div className="mb-5 rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Produk Terlaris Hari Ini</p>
          <div className="space-y-1.5">
            {topProducts.map(([name, data], i) => (
              <div key={name} className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-[#0A0A12]/60 px-3 py-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold"
                  style={{
                    background: i < 3 ? "rgba(45,212,191,.15)" : "rgba(255,255,255,.04)",
                    color: i < 3 ? "#2DD4BF" : "#5A5B7A",
                  }}>
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 truncate text-xs text-[#F0EFF8]">{name}</span>
                <span className="text-xs font-mono text-[#8B8AA0]">{data.qty}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shift summary */}
      {todayShifts.length > 0 && (
        <div className="rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Ringkasan Shift</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-[#0A0A12]/60 p-3 text-center">
              <p className="text-[9px] uppercase text-[#5A5B7A]">Total Shift</p>
              <p className="text-lg font-bold text-[#38BDF8]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{todayShifts.length}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-[#0A0A12]/60 p-3 text-center">
              <p className="text-[9px] uppercase text-[#5A5B7A]">Omzet via Shift</p>
              <p className="text-sm font-bold text-[#2DD4BF]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(totalShiftOmzet)}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-[#0A0A12]/60 p-3 text-center">
              <p className="text-[9px] uppercase text-[#5A5B7A]">Order via Shift</p>
              <p className="text-lg font-bold text-[#8B5CF6]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{totalShiftOrders}</p>
            </div>
          </div>
        </div>
      )}

      {/* Riwayat transaksi */}
      {todayTransactions.length > 0 && (
        <div className="mt-5 rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Riwayat Transaksi Hari Ini</p>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto scrollbar-none">
            {todayTransactions.map(t => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-[#0A0A12]/60 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs text-[#F0EFF8]">{t.description || "Transaksi"}</p>
                  <p className="text-[9px] text-[#5A5B7A] font-mono">
                    {new Date(t.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <p className="text-xs font-semibold text-[#2DD4BF]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  +{fmtRp(Number(t.amount))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
