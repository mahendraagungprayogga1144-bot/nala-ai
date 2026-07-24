"use client";
import { Users, DollarSign, TrendingUp, TrendingDown, UserPlus, BarChart3, UserCheck, Mail } from "lucide-react";
import type { RecentUser } from "./page";

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }

function timeAgo(d: string | null) {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  const months = Math.floor(days / 30);
  return `${months} bulan lalu`;
}

const PLAN_COLORS: Record<string, string> = { free: "#8B8AA0", starter: "#38BDF8", pro: "#2DD4BF", enterprise: "#A78BFA" };

export default function AdminOverviewClient({
  totalUsers, activeToday, wau = 0, mau = 0, trialActive = 0, funnel,
  newUsersThisMonth, revenueThisMonth, revenueThisYear,
  churnRate, planCounts, userGrowth, revenueByMonth, totalBusinesses, recentUsers,
  topModules = [],
  stalePendingCount = 0,
}: {
  totalUsers: number; activeToday: number; wau?: number; mau?: number; trialActive?: number;
  funnel?: { signup: number; business: number; first_action: number };
  newUsersThisMonth: number;
  revenueThisMonth: number; revenueThisYear: number;
  churnRate: number; planCounts: Record<string, number>;
  userGrowth: { month: string; count: number }[];
  revenueByMonth: { month: string; revenue: number }[];
  totalBusinesses: number;
  recentUsers: RecentUser[];
  topModules?: { module: string; count: number }[];
  stalePendingCount?: number;
}) {
  const kpis = [
    { label: "Total User", value: String(totalUsers), icon: Users, color: "#2DD4BF" },
    { label: "DAU", value: String(activeToday), icon: UserCheck, color: "#4ADE80" },
    { label: "WAU", value: String(wau), icon: UserCheck, color: "#38BDF8" },
    { label: "MAU", value: String(mau), icon: Users, color: "#A78BFA" },
    { label: "Trial Aktif", value: String(trialActive), icon: UserPlus, color: "#F59E0B" },
    { label: "User Baru Bulan Ini", value: String(newUsersThisMonth), icon: UserPlus, color: "#38BDF8" },
    { label: "Revenue Bulan Ini", value: fmtRp(revenueThisMonth), icon: DollarSign, color: "#F59E0B" },
    { label: "Revenue Tahun Ini", value: fmtRp(revenueThisYear), icon: TrendingUp, color: "#A78BFA" },
    { label: "Total Bisnis", value: String(totalBusinesses), icon: BarChart3, color: "#EC4899" },
    { label: "Churn Rate", value: churnRate + "%", icon: TrendingDown, color: churnRate > 10 ? "#EC4899" : "#4ADE80" },
  ];

  const maxGrowth = Math.max(...userGrowth.map(g => g.count), 1);
  const maxRevenue = Math.max(...revenueByMonth.map(r => r.revenue), 1);
  const totalSubs = Object.values(planCounts).reduce((s, v) => s + v, 0) || 1;
  const funnelData = funnel || { signup: totalUsers, business: totalBusinesses, first_action: 0 };
  const funnelMax = Math.max(funnelData.signup, funnelData.business, funnelData.first_action, 1);

  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">Admin Overview</h1>
        <p className="text-xs text-[#5A5B7A]">Statistik platform Gercep AI</p>
        {stalePendingCount > 0 && (
          <a
            href="/admin/payments"
            className="mt-3 inline-flex rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-2 text-xs font-semibold text-[#F59E0B]"
          >
            {stalePendingCount} payment pending &gt; 6 jam — ACC sekarang
          </a>
        )}
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
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

      <div className="mb-6 rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Funnel signup → bisnis → first action</p>
        <div className="space-y-3">
          {[
            { label: "Signup", value: funnelData.signup },
            { label: "Punya bisnis", value: funnelData.business },
            { label: "First action", value: funnelData.first_action },
          ].map((step) => (
            <div key={step.label}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-[#8B8AA0]">{step.label}</span>
                <span className="font-mono text-[#F2F1F8]">{step.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-[#2DD4BF]"
                  style={{ width: `${Math.round((step.value / funnelMax) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {topModules.length > 0 && (
        <div className="mb-6 rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Top modules hari ini</p>
          <div className="flex flex-wrap gap-2">
            {topModules.map((m) => (
              <span
                key={m.module}
                className="rounded-full border border-[#2DD4BF]/20 bg-[#2DD4BF]/10 px-3 py-1 text-xs text-[#2DD4BF]"
              >
                {m.module} · {m.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent logged in users */}
      <div className="mb-6 rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
        <div className="mb-4 flex items-center gap-2">
          <Mail size={14} className="text-[#2DD4BF]" />
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">User Login Terbaru</p>
          <span className="ml-auto rounded-full bg-[#4ADE80]/15 px-2 py-0.5 text-[10px] font-bold text-[#4ADE80]">{activeToday} aktif hari ini</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Email", "Nama", "Paket", "Terakhir Login", "Terdaftar"].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[#5A5B7A]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentUsers.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-[#3A3B52]">Belum ada data login</td></tr>
              ) : recentUsers.map(u => {
                const isOnline = u.last_sign_in && (Date.now() - new Date(u.last_sign_in).getTime()) < 86_400_000;
                return (
                  <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={"h-2 w-2 rounded-full flex-shrink-0 " + (isOnline ? "bg-[#4ADE80]" : "bg-[#3A3B52]")} />
                        <span className="text-xs font-medium text-[#F0EFF8]">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[#8B8AA0]">{u.name || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ background: (PLAN_COLORS[u.plan] || "#8B8AA0") + "22", color: PLAN_COLORS[u.plan] }}>
                        {u.plan.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={"text-xs font-mono " + (isOnline ? "text-[#4ADE80]" : "text-[#5A5B7A]")}>{timeAgo(u.last_sign_in)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[10px] font-mono text-[#5A5B7A]">{timeAgo(u.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
