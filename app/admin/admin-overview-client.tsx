"use client";
import { Users, DollarSign, TrendingUp, TrendingDown, UserPlus, BarChart3 } from "lucide-react";

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }

const PLAN_COLORS: Record<string, string> = { free: "#8B8AA0", starter: "#38BDF8", pro: "#2DD4BF", enterprise: "#A78BFA" };

export default function AdminOverviewClient({
  totalUsers, newUsersThisMonth, revenueThisMonth, revenueThisYear,
  churnRate, planCounts, userGrowth, revenueByMonth, totalBusinesses,
}: {
  totalUsers: number; newUsersThisMonth: number;
  revenueThisMonth: number; revenueThisYear: number;
  churnRate: number; planCounts: Record<string, number>;
  userGrowth: { month: string; count: number }[];
  revenueByMonth: { month: string; revenue: number }[];
  totalBusinesses: number;
}) {
  const kpis = [
    { label: "Total User", value: String(totalUsers), icon: Users, color: "#2DD4BF" },
    { label: "User Baru Bulan Ini", value: String(newUsersThisMonth), icon: UserPlus, color: "#38BDF8" },
    { label: "Revenue Bulan Ini", value: fmtRp(revenueThisMonth), icon: DollarSign, color: "#4ADE80" },
    { label: "Revenue Tahun Ini", value: fmtRp(revenueThisYear), icon: TrendingUp, color: "#A78BFA" },
    { label: "Total Bisnis", value: String(totalBusinesses), icon: BarChart3, color: "#F59E0B" },
    { label: "Churn Rate", value: churnRate + "%", icon: TrendingDown, color: churnRate > 10 ? "#EC4899" : "#4ADE80" },
  ];

  const maxGrowth = Math.max(...userGrowth.map(g => g.count), 1);
  const maxRevenue = Math.max(...revenueByMonth.map(r => r.revenue), 1);
  const totalSubs = Object.values(planCounts).reduce((s, v) => s + v, 0) || 1;

  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">Admin Overview</h1>
        <p className="text-xs text-[#5A5B7A]">Statistik platform Gercep AI</p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map(k => (
          <div key={k.label} className="rounded-2xl border p-4" style={{ borderColor: k.color + "33", background: "#0D0D1A" }}>
            <div className="mb-2 flex items-center gap-1.5">
              <k.icon size={12} style={{ color: k.color }} />
              <p className="text-[9px] uppercase tracking-wide text-[#8B8AA0]">{k.label}</p>
            </div>
            <p className="text-lg font-bold" style={{ color: k.color, fontFamily: "'JetBrains Mono', monospace" }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* User Growth */}
        <div className="rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Pertumbuhan User</p>
          {userGrowth.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#3A3B52]">Belum ada data</p>
          ) : (
            <div className="flex items-end gap-1.5" style={{ height: 160 }}>
              {userGrowth.slice(-12).map(g => {
                const pct = (g.count / maxGrowth) * 100;
                return (
                  <div key={g.month} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[8px] font-mono text-[#8B8AA0]">{g.count}</span>
                    <div className="w-full max-w-[28px] rounded-t-lg" style={{
                      height: `${Math.max(pct, 8)}%`,
                      background: "linear-gradient(180deg, #2DD4BF, #8B5CF6)",
                    }} />
                    <span className="text-[8px] text-[#5A5B7A]">{g.month.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Revenue */}
        <div className="rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Revenue per Bulan</p>
          {revenueByMonth.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#3A3B52]">Belum ada data pembayaran</p>
          ) : (
            <div className="flex items-end gap-1.5" style={{ height: 160 }}>
              {revenueByMonth.slice(-12).map(r => {
                const pct = (r.revenue / maxRevenue) * 100;
                return (
                  <div key={r.month} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[7px] font-mono text-[#8B8AA0]">{fmtRp(r.revenue)}</span>
                    <div className="w-full max-w-[28px] rounded-t-lg" style={{
                      height: `${Math.max(pct, 8)}%`,
                      background: "linear-gradient(180deg, #4ADE80, #2DD4BF)",
                    }} />
                    <span className="text-[8px] text-[#5A5B7A]">{r.month.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Plan distribution */}
        <div className="rounded-2xl border border-white/[0.08] p-5 lg:col-span-2" style={{ background: "#0D0D1A" }}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Distribusi Paket</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["free", "starter", "pro", "enterprise"] as const).map(plan => {
              const count = planCounts[plan] || 0;
              const pct = Math.round((count / totalSubs) * 100);
              const color = PLAN_COLORS[plan];
              return (
                <div key={plan} className="rounded-xl border p-4" style={{ borderColor: color + "22", background: color + "08" }}>
                  <p className="mb-1 text-[10px] font-semibold uppercase" style={{ color }}>{plan}</p>
                  <p className="text-2xl font-bold" style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>{count}</p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <p className="mt-1 text-[9px] text-[#5A5B7A]">{pct}% dari total</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
