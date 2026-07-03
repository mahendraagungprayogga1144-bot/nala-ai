"use client";
import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ShoppingBag, Package, Store, DollarSign } from "lucide-react";
import type { MpStore, MpProduct, MpOrder } from "../page";
import { platformColor, fmtRp, STATUS_STYLE } from "../mp-constants";

export default function MpDashboardTab({
  stores, products, orders,
}: { stores: MpStore[]; products: MpProduct[]; orders: MpOrder[] }) {
  const kpis = useMemo(() => {
    const activeOrders = orders.filter(o => o.status !== "batal");
    return {
      omzet: activeOrders.reduce((s, o) => s + Number(o.total || 0), 0),
      totalPesanan: orders.length,
      totalToko: stores.length,
      totalProduk: products.length,
    };
  }, [stores, products, orders]);

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    orders.filter(o => o.status !== "batal").forEach(o => {
      const p = o.platform || "Lainnya";
      map[p] = (map[p] || 0) + Number(o.total || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const recentOrders = orders.slice(0, 5);

  const cards = [
    { label: "Total Omzet", value: fmtRp(kpis.omzet), icon: DollarSign, color: "#2DD4BF", border: "rgba(45,212,191,.3)" },
    { label: "Total Pesanan", value: String(kpis.totalPesanan), icon: ShoppingBag, color: "#A78BFA", border: "rgba(167,139,250,.3)" },
    { label: "Jumlah Toko", value: String(kpis.totalToko), icon: Store, color: "#EC4899", border: "rgba(236,72,153,.3)" },
    { label: "Total Produk", value: String(kpis.totalProduk), icon: Package, color: "#FBBF24", border: "rgba(251,191,36,.3)" },
  ];

  return (
    <div>
      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(c => (
          <div key={c.label} className="rounded-2xl border bg-[#0D0D1A] p-4" style={{ borderColor: c.border }}>
            <div className="mb-2 flex items-center gap-2">
              <c.icon size={16} style={{ color: c.color }} />
              <p className="text-[10px] uppercase tracking-wide text-[#8B8AA0]">{c.label}</p>
            </div>
            <p className="font-mono text-lg font-bold" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pie chart */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Omzet per platform</p>
          {pieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#5A5B7A]">Belum ada data pesanan</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {pieData.map(d => (
                    <Cell key={d.name} fill={platformColor(d.name)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#13131F", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => fmtRp(Number(v))}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {pieData.map(d => (
              <span key={d.name} className="flex items-center gap-1.5 text-[10px] text-[#8B8AA0]">
                <span className="h-2 w-2 rounded-full" style={{ background: platformColor(d.name) }} />
                {d.name}
              </span>
            ))}
          </div>
        </div>

        {/* Recent orders */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Pesanan terakhir</p>
          {recentOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#5A5B7A]">Belum ada pesanan</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentOrders.map(o => {
                const st = STATUS_STYLE[o.status] || STATUS_STYLE.baru;
                return (
                  <div key={o.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0A0A12]/60 px-3 py-2">
                    <div className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ background: platformColor(o.platform) + "22", color: platformColor(o.platform) }}>
                      {(o.platform || "?")[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{o.pembeli}</p>
                      <p className="text-[10px] text-[#5A5B7A]">{o.no_pesanan || "—"} · {o.tanggal}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs font-semibold text-[#2DD4BF]">{fmtRp(Number(o.total))}</p>
                      <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}` }}>
                        {o.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
