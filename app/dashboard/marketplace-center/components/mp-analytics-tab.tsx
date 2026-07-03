"use client";
import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { TrendingUp, Award, ShoppingBag, Calculator } from "lucide-react";
import type { MpStore, MpProduct, MpOrder } from "../page";
import { platformColor, fmtRp, PLATFORM_COLOR } from "../mp-constants";

export default function MpAnalyticsTab({
  stores, products, orders,
}: { stores: MpStore[]; products: MpProduct[]; orders: MpOrder[] }) {
  const activeOrders = useMemo(() => orders.filter(o => o.status !== "batal"), [orders]);

  const trendData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const platforms = [...new Set(activeOrders.map(o => o.platform || "Lainnya"))];
    const days: Record<string, Record<string, number>> = {};

    for (let d = 1; d <= daysInMonth; d++) {
      const key = String(d).padStart(2, "0");
      days[key] = {};
      platforms.forEach(p => { days[key][p] = 0; });
    }
    activeOrders.forEach(o => {
      const date = new Date(o.tanggal);
      if (date.getMonth() === month && date.getFullYear() === year) {
        const key = String(date.getDate()).padStart(2, "0");
        const p = o.platform || "Lainnya";
        if (days[key]) days[key][p] = (days[key][p] || 0) + Number(o.total);
      }
    });

    return Object.entries(days).map(([day, vals]) => ({ day, ...vals }));
  }, [activeOrders]);

  const platforms = useMemo(() => [...new Set(activeOrders.map(o => o.platform || "Lainnya"))], [activeOrders]);

  const storeRank = useMemo(() => {
    const map: Record<string, { name: string; platform: string; omzet: number }> = {};
    stores.forEach(s => { map[s.id] = { name: s.nama_toko, platform: s.platform, omzet: 0 }; });
    activeOrders.forEach(o => {
      if (map[o.store_id]) map[o.store_id].omzet += Number(o.total);
    });
    return Object.values(map).sort((a, b) => b.omzet - a.omzet);
  }, [stores, activeOrders]);

  const insights = useMemo(() => {
    const topStore = storeRank[0];
    const productSales: Record<string, number> = {};
    products.forEach(p => { productSales[p.nama] = (productSales[p.nama] || 0) + Number(p.stok); });
    const topProduct = products.length > 0
      ? products.reduce((a, b) => Number(a.harga) * Number(a.stok) > Number(b.harga) * Number(b.stok) ? a : b)
      : null;
    const avgOrder = activeOrders.length > 0
      ? activeOrders.reduce((s, o) => s + Number(o.total), 0) / activeOrders.length
      : 0;

    return { topStore, topProduct, avgOrder };
  }, [storeRank, products, activeOrders]);

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
        <p className="text-sm text-[#5A5B7A]">Belum ada data untuk analitik. Mulai input pesanan terlebih dahulu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Insight cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#2DD4BF]/20 bg-[#0D0D1A] p-4">
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-[#8B8AA0]"><Award size={12} className="text-[#2DD4BF]" /> Toko Terlaris</div>
          <p className="font-medium">{insights.topStore?.name || "—"}</p>
          <p className="font-mono text-xs text-[#2DD4BF]">{insights.topStore ? fmtRp(insights.topStore.omzet) : "—"}</p>
        </div>
        <div className="rounded-2xl border border-[#A78BFA]/20 bg-[#0D0D1A] p-4">
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-[#8B8AA0]"><ShoppingBag size={12} className="text-[#A78BFA]" /> Produk Unggulan</div>
          <p className="font-medium">{insights.topProduct?.nama || "—"}</p>
          <p className="font-mono text-xs text-[#A78BFA]">{insights.topProduct ? fmtRp(Number(insights.topProduct.harga)) : "—"}</p>
        </div>
        <div className="rounded-2xl border border-[#FBBF24]/20 bg-[#0D0D1A] p-4">
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-[#8B8AA0]"><Calculator size={12} className="text-[#FBBF24]" /> Rata-rata Order</div>
          <p className="font-mono text-lg font-bold text-[#FBBF24]">{fmtRp(insights.avgOrder)}</p>
        </div>
      </div>

      {/* Trend chart */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-5">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={14} className="text-[#2DD4BF]" />
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Tren omzet bulan ini</p>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={trendData}>
            <defs>
              {platforms.map(p => (
                <linearGradient key={p} id={`grad-${p.replace(/\s+/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={platformColor(p)} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={platformColor(p)} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
            <XAxis dataKey="day" tick={{ fill: "#5A5B7A", fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#5A5B7A", fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: "#13131F", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 12 }}
              formatter={(v) => fmtRp(Number(v))}
            />
            {platforms.map(p => (
              <Area key={p} type="monotone" dataKey={p} stroke={platformColor(p)} fillOpacity={1} fill={`url(#grad-${p.replace(/\s+/g, "")})`} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap justify-center gap-4">
          {platforms.map(p => (
            <span key={p} className="flex items-center gap-1.5 text-[10px] text-[#8B8AA0]">
              <span className="h-2 w-2 rounded-full" style={{ background: platformColor(p) }} /> {p}
            </span>
          ))}
        </div>
      </div>

      {/* Store comparison */}
      {storeRank.length > 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Perbandingan omzet per toko</p>
          <ResponsiveContainer width="100%" height={Math.max(storeRank.length * 40, 120)}>
            <BarChart data={storeRank} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
              <XAxis type="number" tick={{ fill: "#5A5B7A", fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#8B8AA0", fontSize: 11 }} width={100} />
              <Tooltip
                contentStyle={{ background: "#13131F", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 12 }}
                formatter={(v) => fmtRp(Number(v))}
              />
              <Bar dataKey="omzet" radius={[0, 6, 6, 0]}>
                {storeRank.map((d, i) => (
                  <Cell key={i} fill={platformColor(d.platform)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
