"use client";
import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Transaction = { type: string; amount: number; transaction_date: string | null; created_at: string };

function txDayKey(t: Transaction): string | null {
  const raw = t.transaction_date || t.created_at;
  if (!raw) return null;
  return String(raw).split("T")[0] || null;
}

export default function CashFlowChart({
  transactions,
  title = "Tren Saldo",
}: {
  transactions: Transaction[];
  title?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const sorted = [...transactions].sort((a, b) => {
    const dateA = txDayKey(a) || "";
    const dateB = txDayKey(b) || "";
    return dateA.localeCompare(dateB);
  });

  const grouped: Record<string, number> = {};
  sorted.forEach((t) => {
    const key = txDayKey(t);
    if (!key) return;
    const delta = t.type === "pemasukan" ? Number(t.amount) : -Number(t.amount);
    grouped[key] = (grouped[key] || 0) + delta;
  });

  let running = 0;
  const data = Object.entries(grouped).map(([date, delta]) => {
    running += delta;
    return {
      date: new Date(date + "T12:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" }),
      saldo: running,
    };
  });

  const isUp = data.length >= 2 ? data[data.length - 1].saldo >= data[0].saldo : true;
  const color = isUp ? "#2DD4BF" : "#EC4899";

  return (
    <div className="relative bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 mb-6 overflow-hidden">
      <div
        className="absolute w-72 h-72 rounded-full -top-20 -right-20 pointer-events-none transition-opacity duration-1000"
        style={{ background: color, filter: "blur(90px)", opacity: mounted ? 0.18 : 0 }}
      />
      <div className="relative flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-[#8B8AA0]">Pergerakan kas dari waktu ke waktu</p>
        </div>
        {data.length > 0 && (
          <p className="font-mono text-lg font-semibold" style={{ color }}>
            Rp{data[data.length - 1].saldo.toLocaleString("id-ID")}
          </p>
        )}
      </div>

      {data.length >= 2 ? (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="cashflowGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#8B8AA0", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#8B8AA0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
            <Tooltip
              contentStyle={{ background: "#0A0A12", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
              formatter={(value: any) => [`Rp${Number(value).toLocaleString("id-ID")}`, "Saldo"]}
            />
            <Area
              type="monotone"
              dataKey="saldo"
              stroke={color}
              strokeWidth={2.5}
              fill="url(#cashflowGradient)"
              isAnimationActive={mounted}
              animationDuration={1200}
              animationEasing="ease-out"
              dot={false}
              activeDot={{ r: 5, fill: color, stroke: "#0A0A12", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[180px] flex items-center justify-center text-center px-6">
          <p className="text-sm text-[#8B8AA0]">Grafik bakal muncul setelah ada transaksi dari beberapa hari berbeda.</p>
        </div>
      )}
    </div>
  );
}
