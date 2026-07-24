"use client";
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Product = { name: string; stock: number; price: number | null };

const COLORS = ["#38BDF8", "#8B5CF6", "#EC4899", "#2DD4BF", "#F59E0B", "#6366F1"];

export default function InventoryCharts({ products }: { products: Product[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pieData = products.map((p) => ({ name: p.name, value: (p.price || 0) * p.stock })).filter((p) => p.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
  const barData = products.map((p) => ({ name: p.name, stok: p.stock })).sort((a, b) => b.stok - a.stok).slice(0, 6);

  if (products.length === 0) return null;
  if (!mounted) return <div className="mb-6 h-40 animate-pulse rounded-2xl bg-white/[0.04]" />;

  return (
    <div className="grid sm:grid-cols-2 gap-4 mb-6">
      <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5">
        <h3 className="text-sm font-medium mb-4">Distribusi Nilai Stok</h3>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0A0A12", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(value: any) => [`Rp${Number(value).toLocaleString("id-ID")}`, "Nilai"]} />
            </PieChart>
          </ResponsiveContainer>
        ) : <p className="text-xs text-[#8B8AA0] text-center py-16">Belum ada data harga produk.</p>}
        <div className="flex flex-wrap gap-2 mt-2">
          {pieData.map((p, i) => (
            <span key={p.name} className="flex items-center gap-1.5 text-[10px] text-[#8B8AA0]">
              <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{p.name}
            </span>
          ))}
        </div>
      </div>
      <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5">
        <h3 className="text-sm font-medium mb-4">Perbandingan Jumlah Stok</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#8B8AA0", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#8B8AA0", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#0A0A12", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="stok" fill="#2DD4BF" radius={[6, 6, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
