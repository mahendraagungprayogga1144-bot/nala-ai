"use client";
import { useEffect, useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { AgriDashboardData } from "../lib/types";
import { isHarvestCategory, cardCls, fmtRp } from "../lib/constants";

const COLORS = ["#8b5cf6", "#2dd4bf", "#38bdf8", "#f59e0b", "#ec4899"];

export default function AgriCharts({ data }: { data: AgriDashboardData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const harvestProducts = data.products.filter(p => isHarvestCategory(p.category));
  const productionByCat = harvestProducts.reduce<Record<string, number>>((acc, p) => {
    const cat = p.category || "Lainnya";
    acc[cat] = (acc[cat] || 0) + p.stock;
    return acc;
  }, {});
  const prodChart = Object.entries(productionByCat).map(([name, value]) => ({ name, value }));

  const profitChart = data.history.slice(-12).map(h => ({
    date: h.snapshot_date.slice(5),
    nilai: h.total_value,
  }));

  const costByCat = data.costs.reduce<Record<string, number>>((acc, c) => {
    acc[c.kategori] = (acc[c.kategori] || 0) + Number(c.jumlah);
    return acc;
  }, {});

  if (!mounted) {
    return <div className="mb-4 h-48 animate-pulse rounded-2xl bg-white/[0.04]" />;
  }
  const costChart = Object.entries(costByCat).map(([name, value]) => ({ name, value }));

  const tooltipStyle = { background: "#1a2030", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className={`${cardCls} p-4 lg:col-span-1`}>
        <h4 className="text-sm font-medium mb-3">Grafik Produksi</h4>
        {prodChart.length === 0 ? <p className="text-xs text-[#8B8AA0] py-8 text-center">Belum ada data panen</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={prodChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                {prodChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} unit`, "Stok"]} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className={`${cardCls} p-4 lg:col-span-1`}>
        <h4 className="text-sm font-medium mb-3">Grafik Nilai Inventory</h4>
        {profitChart.length < 2 ? <p className="text-xs text-[#8B8AA0] py-8 text-center">Data tren akan muncul seiring waktu</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={profitChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fill: "#8B8AA0", fontSize: 10 }} />
              <YAxis tick={{ fill: "#8B8AA0", fontSize: 10 }} tickFormatter={v => fmtRp(v)} width={50} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtRp(Number(v)), "Nilai"]} />
              <Area type="monotone" dataKey="nilai" stroke="#8b5cf6" fill="url(#agriGrad)" strokeWidth={2} />
              <defs>
                <linearGradient id="agriGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className={`${cardCls} p-4 lg:col-span-1`}>
        <h4 className="text-sm font-medium mb-3">Grafik Biaya Produksi</h4>
        {costChart.length === 0 ? <p className="text-xs text-[#8B8AA0] py-8 text-center">Belum ada biaya tercatat</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={costChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: "#8B8AA0", fontSize: 9 }} />
              <YAxis tick={{ fill: "#8B8AA0", fontSize: 10 }} tickFormatter={v => fmtRp(v)} width={50} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtRp(Number(v)), "Biaya"]} />
              <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
