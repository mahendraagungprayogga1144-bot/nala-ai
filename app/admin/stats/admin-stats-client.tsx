"use client";
import { Store, ShoppingCart, BarChart3, Users, TrendingUp } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  kuliner: "#F59E0B", retail: "#38BDF8", fashion: "#EC4899", homeindustry: "#A78BFA",
  ternak: "#4ADE80", pertanian: "#2DD4BF", jasa: "#F97316", lainnya: "#8B8AA0",
};

const TYPE_LABELS: Record<string, string> = {
  kuliner: "Kuliner / F&B", retail: "Retail", fashion: "Fashion", homeindustry: "Home Industry",
  ternak: "Peternakan", pertanian: "Pertanian", jasa: "Jasa", lainnya: "Lainnya",
};

export default function AdminStatsClient({
  totalBusinesses, typeBreakdown, topUsers, topCategories, totalTransactions, totalOrders,
}: {
  totalBusinesses: number;
  typeBreakdown: Record<string, number>;
  topUsers: { user_id: string; name: string; count: number }[];
  topCategories: [string, number][];
  totalTransactions: number; totalOrders: number;
}) {
  const maxType = Math.max(...Object.values(typeBreakdown), 1);
  const maxCat = topCategories.length > 0 ? topCategories[0][1] : 1;
  const maxUser = topUsers.length > 0 ? topUsers[0].count : 1;

  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">Statistik Bisnis</h1>
        <p className="text-xs text-[#5A5B7A]">Data dari seluruh platform</p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Bisnis", value: String(totalBusinesses), icon: Store, color: "#2DD4BF" },
          { label: "Total Transaksi", value: String(totalTransactions), icon: TrendingUp, color: "#38BDF8" },
          { label: "Total Order", value: String(totalOrders), icon: ShoppingCart, color: "#A78BFA" },
          { label: "Jenis Bisnis", value: String(Object.keys(typeBreakdown).length), icon: BarChart3, color: "#F59E0B" },
        ].map(k => (
          <div key={k.label} className="rounded-2xl border p-4" style={{ borderColor: k.color + "33", background: "#0D0D1A" }}>
            <div className="mb-2 flex items-center gap-1.5">
              <k.icon size={12} style={{ color: k.color }} />
              <p className="text-[9px] uppercase tracking-wide text-[#8B8AA0]">{k.label}</p>
            </div>
            <p className="text-xl font-bold" style={{ color: k.color, fontFamily: "'JetBrains Mono', monospace" }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Type breakdown */}
        <div className="rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Bisnis per Jenis</p>
          <div className="space-y-2.5">
            {Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const color = TYPE_COLORS[type] || "#8B8AA0";
              const pct = (count / maxType) * 100;
              return (
                <div key={type}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-[#C4C3D4]">{TYPE_LABELS[type] || type}</span>
                    <span className="text-xs font-bold font-mono" style={{ color }}>{count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top users */}
        <div className="rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">
            <Users size={12} className="inline mr-1" /> User Paling Aktif (Top 10)
          </p>
          <div className="space-y-2">
            {topUsers.map((u, i) => {
              const pct = (u.count / maxUser) * 100;
              return (
                <div key={u.user_id} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold"
                    style={{ background: i < 3 ? "rgba(45,212,191,.15)" : "rgba(255,255,255,.04)", color: i < 3 ? "#2DD4BF" : "#5A5B7A" }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="mb-0.5 flex items-center justify-between">
                      <span className="truncate text-xs text-[#F0EFF8]">{u.name}</span>
                      <span className="text-[10px] font-mono text-[#8B8AA0]">{u.count} aktivitas</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #2DD4BF, #8B5CF6)" }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {topUsers.length === 0 && <p className="py-4 text-center text-xs text-[#3A3B52]">Belum ada data</p>}
          </div>
        </div>

        {/* Top categories */}
        <div className="rounded-2xl border border-white/[0.08] p-5 lg:col-span-2" style={{ background: "#0D0D1A" }}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Fitur / Kategori Paling Sering Dipakai</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {topCategories.map(([cat, count], i) => {
              const pct = (count / maxCat) * 100;
              const color = i < 3 ? "#2DD4BF" : i < 6 ? "#38BDF8" : "#8B8AA0";
              return (
                <div key={cat} className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-[#0A0A12]/60 px-3 py-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold"
                    style={{ background: color + "15", color }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="truncate text-xs text-[#C4C3D4]">{cat}</span>
                      <span className="text-[10px] font-mono text-[#8B8AA0]">{count}x</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {topCategories.length === 0 && <p className="col-span-2 py-4 text-center text-xs text-[#3A3B52]">Belum ada data</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
