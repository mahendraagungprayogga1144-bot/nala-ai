"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPct, formatRp, formatRpShort, formatX } from "@/lib/gercep-profit/format";
import type { DemoDashboard } from "@/lib/gercep-profit/demo";
import type { ProfitCalcResult } from "@/lib/gercep-profit/types";
import BreakdownModal from "./components/breakdown-modal";
import MetricCard from "./components/metric-card";
import StatusBadge from "./components/status-badge";

const TOOLTIP = {
  background: "#0A0A12",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  fontSize: 12,
} as const;

export default function ProfitDashboardClient({ data }: { data: DemoDashboard }) {
  const { totals, campaigns, daily } = data;
  const [open, setOpen] = useState<ProfitCalcResult | null>(null);

  const decisionPie = useMemo(() => {
    const counts = { SCALE: 0, OPTIMIZE: 0, STOP: 0, PRODUCT_NOT_PROFITABLE: 0 };
    for (const c of campaigns) counts[c.result.decision.status] += 1;
    return [
      { name: "SCALE", value: counts.SCALE, color: "#10B981" },
      { name: "OPTIMIZE", value: counts.OPTIMIZE, color: "#F59E0B" },
      { name: "STOP", value: counts.STOP + counts.PRODUCT_NOT_PROFITABLE, color: "#F43F5E" },
    ].filter((d) => d.value > 0);
  }, [campaigns]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Total Revenue" value={formatRpShort(totals.revenue.net_revenue)} />
        <MetricCard label="Total COGS" value={formatRpShort(totals.cost.cogs)} />
        <MetricCard label="Platform Fees" value={formatRpShort(totals.platform_fees)} />
        <MetricCard label="Affiliate Fees" value={formatRpShort(totals.affiliate_fees)} />
        <MetricCard label="Ad Spend" value={formatRpShort(totals.advertising.ad_spend)} />
        <MetricCard label="Net Profit" value={formatRpShort(totals.net_profit)} gold />
        <MetricCard
          label="Net Margin"
          value={formatPct(totals.net_margin)}
          accent={ (totals.net_margin ?? 0) >= 0 ? "#34D399" : "#FB7185" }
        />
        <MetricCard label="ROAS" value={formatX(totals.advertising.roas)} accent="#818CF8" />
        <MetricCard label="BE ROAS" value={formatX(totals.be_roas)} accent="#FBBF24" />
        <MetricCard label="ROI" value={formatPct(totals.business_roi)} accent="#F5D76E" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.07] bg-[#101018] p-4 lg:col-span-2">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A7998]">
            Revenue vs Ad Spend
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={daily}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#7A7998", fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fill: "#7A7998", fontSize: 11 }} axisLine={false} tickFormatter={(v) => formatRpShort(Number(v))} />
                <Tooltip contentStyle={TOOLTIP} formatter={(v) => formatRp(Number(v))} />
                <Bar dataKey="revenue" name="Revenue" fill="#6366F1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ad_spend" name="Ad Spend" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#101018] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A7998]">
            Decision Summary
          </p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={decisionPie} dataKey="value" innerRadius={42} outerRadius={68} paddingAngle={3}>
                  {decisionPie.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5 text-xs">
            {decisionPie.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-[#A8A7C0]">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  {d.name}
                </span>
                <span className="font-mono">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#101018] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A7998]">Profit Trend</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={daily}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7A7998", fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: "#7A7998", fontSize: 11 }} axisLine={false} tickFormatter={(v) => formatRpShort(Number(v))} />
              <Tooltip contentStyle={TOOLTIP} formatter={(v) => formatRp(Number(v))} />
              <Line type="monotone" dataKey="net_profit" name="Net Profit" stroke="#F5D76E" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="contribution" name="Contribution" stroke="#34D399" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#101018] md:block">
        <table className="min-w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.12em] text-[#6B6A85]">
            <tr>
              {["Campaign", "Spend", "Revenue", "Orders", "CPA", "ROAS", "BE ROAS", "Net Profit", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-white/[0.05]">
                <td className="px-4 py-3 text-[#E4E3F0]">{c.name}</td>
                <td className="px-4 py-3 font-mono">{formatRp(c.result.advertising.ad_spend)}</td>
                <td className="px-4 py-3 font-mono">{formatRp(c.result.revenue.net_revenue)}</td>
                <td className="px-4 py-3 font-mono">{c.result.quantity}</td>
                <td className="px-4 py-3 font-mono">{c.result.advertising.cpa == null ? "N/A" : formatRp(c.result.advertising.cpa)}</td>
                <td className="px-4 py-3 font-mono">{formatX(c.result.advertising.roas)}</td>
                <td className="px-4 py-3 font-mono">{formatX(c.result.be_roas)}</td>
                <td className="px-4 py-3 font-mono text-[#F5D76E]">{formatRp(c.result.net_profit)}</td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setOpen(c.result)}>
                    <StatusBadge status={c.result.decision.status} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2.5 md:hidden">
        {campaigns.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setOpen(c.result)}
            className="w-full rounded-2xl border border-white/[0.07] bg-[#101018] p-4 text-left"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-[#F4F3FB]">{c.name}</p>
              <StatusBadge status={c.result.decision.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[#6B6A85]">Net Profit</p>
                <p className="font-mono text-[#F5D76E]">{formatRp(c.result.net_profit)}</p>
              </div>
              <div>
                <p className="text-[#6B6A85]">ROAS / BE</p>
                <p className="font-mono text-[#E4E3F0]">
                  {formatX(c.result.advertising.roas)} · {formatX(c.result.be_roas)}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen(totals)}
          className="text-xs text-[#8B8AA0] underline"
        >
          View calculation — portfolio totals
        </button>
        <Link
          href="/dashboard/profit-engine/decide"
          className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-2 text-xs font-medium text-[#F5D76E]"
        >
          What should I do?
        </Link>
      </div>

      {open ? <BreakdownModal result={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
