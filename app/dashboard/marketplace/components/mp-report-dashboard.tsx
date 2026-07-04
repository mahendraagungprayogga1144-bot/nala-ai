"use client";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, Legend,
} from "recharts";
import { DollarSign, TrendingDown, Wallet, TrendingUp } from "lucide-react";
import type { MpReport, MpParsedOrder } from "../page";

const PLAT_COLOR: Record<string, string> = {
  Shopee: "#F97316",
  "TikTok Shop": "#EC4899",
  Tokopedia: "#22C55E",
};

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }
function platColor(p: string) { return PLAT_COLOR[p] || "#8B8AA0"; }

export default function MpReportDashboard({
  reports, parsedOrders,
}: { reports: MpReport[]; parsedOrders: MpParsedOrder[] }) {
  const kpi = useMemo(() => {
    const omzet = reports.reduce((s, r) => s + Number(r.total_omzet), 0);
    const fee = reports.reduce((s, r) => s + Number(r.total_fee), 0);
    const dana = reports.reduce((s, r) => s + Number(r.dana_diterima), 0);
    return { omzet, fee, dana, profit: dana };
  }, [reports]);

  const barData = useMemo(() => {
    const map: Record<string, number> = {};
    reports.forEach(r => { map[r.platform] = (map[r.platform] || 0) + Number(r.total_omzet); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [reports]);

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    reports.forEach(r => { map[r.platform] = (map[r.platform] || 0) + Number(r.dana_diterima); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [reports]);

  const weeklyData = useMemo(() => {
    const weeks: Record<string, Record<string, number>> = {};
    const platforms = [...new Set(parsedOrders.map(o => o.platform))];

    parsedOrders.forEach(o => {
      if (!o.tanggal) return;
      const d = new Date(o.tanggal);
      if (isNaN(d.getTime())) return;
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
      if (!weeks[key]) { weeks[key] = {}; platforms.forEach(p => { weeks[key][p] = 0; }); }
      weeks[key][o.platform] = (weeks[key][o.platform] || 0) + Number(o.harga_jual);
    });

    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, vals]) => ({ week, ...vals }));
  }, [parsedOrders]);

  const platforms = useMemo(() => [...new Set(parsedOrders.map(o => o.platform))], [parsedOrders]);

  const topProducts = useMemo(() => {
    const map: Record<string, { nama: string; qty: number; omzet: number; fee: number; dana: number }> = {};
    parsedOrders.forEach(o => {
      const key = o.nama_produk || "Unknown";
      if (!map[key]) map[key] = { nama: key, qty: 0, omzet: 0, fee: 0, dana: 0 };
      map[key].qty++;
      map[key].omzet += Number(o.harga_jual);
      map[key].fee += Number(o.fee_total);
      map[key].dana += Number(o.dana_diterima);
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 15);
  }, [parsedOrders]);

  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
        <p className="text-sm text-[#5A5B7A]">Belum ada laporan. Upload CSV di tab Upload Laporan.</p>
      </div>
    );
  }

  const cards = [
    { label: "Total Omzet Marketplace", value: fmtRp(kpi.omzet), icon: DollarSign, color: "#2DD4BF" },
    { label: "Total Fee Platform", value: fmtRp(kpi.fee), icon: TrendingDown, color: "#F43F5E" },
    { label: "Dana Diterima Bersih", value: fmtRp(kpi.dana), icon: Wallet, color: "#A78BFA" },
    { label: "Estimasi Profit", value: fmtRp(kpi.profit), icon: TrendingUp, color: "#4ADE80" },
  ];

  const tooltipStyle = { background: "#13131F", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 12 };

  return (
    <div>
      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(c => (
          <div key={c.label} className="rounded-2xl border p-4" style={{ borderColor: c.color + "33", background: "#0D0D1A" }}>
            <div className="mb-2 flex items-center gap-2">
              <c.icon size={16} style={{ color: c.color }} />
              <p className="text-[10px] uppercase tracking-wide text-[#8B8AA0]">{c.label}</p>
            </div>
            <p className="font-bold text-lg" style={{ color: c.color, fontFamily: "'JetBrains Mono', monospace" }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* Bar chart — omzet per platform */}
        <div className="rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Omzet per Platform</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
              <XAxis dataKey="name" tick={{ fill: "#5A5B7A", fontSize: 11 }} />
              <YAxis tick={{ fill: "#5A5B7A", fontSize: 10 }} tickFormatter={v => `${(v / 1_000_000).toFixed(1)}jt`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtRp(Number(v))} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {barData.map(d => <Cell key={d.name} fill={platColor(d.name)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart — kontribusi per platform */}
        <div className="rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Kontribusi Dana per Platform</p>
          {pieData.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#5A5B7A]">Belum ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {pieData.map(d => <Cell key={d.name} fill={platColor(d.name)} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtRp(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 flex flex-wrap justify-center gap-4">
            {pieData.map(d => (
              <span key={d.name} className="flex items-center gap-1.5 text-[10px] text-[#8B8AA0]">
                <span className="h-2 w-2 rounded-full" style={{ background: platColor(d.name) }} /> {d.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Line chart — tren penjualan per minggu */}
      {weeklyData.length > 1 && (
        <div className="mb-6 rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Tren Penjualan per Minggu</p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
              <XAxis dataKey="week" tick={{ fill: "#5A5B7A", fontSize: 10 }} />
              <YAxis tick={{ fill: "#5A5B7A", fontSize: 10 }} tickFormatter={v => `${(v / 1_000_000).toFixed(1)}jt`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtRp(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {platforms.map(p => (
                <Line key={p} type="monotone" dataKey={p} stroke={platColor(p)} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top products table */}
      {topProducts.length > 0 && (
        <div className="rounded-2xl border border-white/[0.08] overflow-x-auto" style={{ background: "#0D0D1A" }}>
          <p className="p-4 pb-2 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Produk Terlaris</p>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-wider text-[#5A5B7A]">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Nama Produk</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Omzet</th>
                <th className="px-4 py-2 text-right">Fee</th>
                <th className="px-4 py-2 text-right">Dana Diterima</th>
                <th className="px-4 py-2 text-right">Avg Margin</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => {
                const margin = p.omzet > 0 ? ((p.dana - p.fee) / p.omzet) * 100 : 0;
                return (
                  <tr key={p.nama} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-[#5A5B7A]">{i + 1}</td>
                    <td className="px-4 py-2.5 max-w-[200px] truncate font-medium">{p.nama}</td>
                    <td className="px-4 py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{p.qty}</td>
                    <td className="px-4 py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(p.omzet)}</td>
                    <td className="px-4 py-2.5 text-right text-[#F43F5E]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(p.fee)}</td>
                    <td className="px-4 py-2.5 text-right text-[#2DD4BF]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(p.dana)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold" style={{ color: margin >= 30 ? "#4ADE80" : margin >= 0 ? "#FBBF24" : "#F43F5E", fontFamily: "'JetBrains Mono', monospace" }}>
                      {margin.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
