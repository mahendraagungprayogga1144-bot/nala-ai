"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
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
import type { DecisionStatus, ProfitCalcResult } from "@/lib/gercep-profit/types";
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

  const counts = useMemo(() => {
    const c = { SCALE: 0, OPTIMIZE: 0, STOP: 0, PRODUCT_NOT_PROFITABLE: 0 };
    for (const row of campaigns) c[row.result.decision.status] += 1;
    return c;
  }, [campaigns]);

  const decisionPie = useMemo(
    () =>
      [
        { name: "SCALE", value: counts.SCALE, color: "#10B981" },
        { name: "OPTIMIZE", value: counts.OPTIMIZE, color: "#F59E0B" },
        { name: "STOP", value: counts.STOP + counts.PRODUCT_NOT_PROFITABLE, color: "#F43F5E" },
      ].filter((d) => d.value > 0),
    [counts],
  );

  const featured =
    campaigns.find((c) => c.result.decision.status === "OPTIMIZE") ||
    campaigns.find((c) => c.result.decision.status === "STOP") ||
    campaigns[0];

  const overallStatus: DecisionStatus = totals.decision.status;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-white/[0.08] bg-[#101018] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A7998]">Portfolio status</p>
              <p className="mt-1 text-lg font-semibold text-[#F4F3FB]">Henima Afternoon · {campaigns.length} campaign</p>
              <p className="mt-1 text-sm text-[#9B9AB5]">{totals.decision.message}</p>
            </div>
            <StatusBadge status={overallStatus} large />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <CountBox label="SCALE" value={counts.SCALE} color="#34D399" />
            <CountBox label="OPTIMIZE" value={counts.OPTIMIZE} color="#FBBF24" />
            <CountBox label="STOP" value={counts.STOP + counts.PRODUCT_NOT_PROFITABLE} color="#FB7185" />
          </div>
        </div>

        {featured ? (
          <div className="rounded-2xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#D4AF37]/10 to-[#101018] p-4 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">What should I do?</p>
            <div className="mt-2 flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-[#F4F3FB]">{featured.name}</p>
              <StatusBadge status={featured.result.decision.status} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Mini k="ROAS" v={formatX(featured.result.advertising.roas)} />
              <Mini k="BE ROAS" v={formatX(featured.result.be_roas)} />
              <Mini k="Target" v={formatX(featured.result.target_roas)} />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#C8C7D8]">{featured.result.decision.recommendation}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOpen(featured.result)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#E4E3F0]"
              >
                View calculation
              </button>
              <Link
                href="/dashboard/profit-engine/decide"
                className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-medium text-[#F5D76E]"
              >
                Semua rekomendasi
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Total Revenue" value={formatRpShort(totals.revenue.net_revenue)} hint={`${totals.quantity} order`} />
        <MetricCard label="Total COGS" value={formatRpShort(totals.cost.cogs)} hint={`HPP ${formatRp(totals.cost.cogs_per_unit)}/unit`} />
        <MetricCard label="Platform Fees" value={formatRpShort(totals.platform_fees)} hint="Fee rules aktif" />
        <MetricCard label="Affiliate Fees" value={formatRpShort(totals.affiliate_fees)} hint="Commission 10%" />
        <MetricCard label="Ad Spend" value={formatRpShort(totals.advertising.ad_spend)} hint={totals.advertising.cpa == null ? "CPA N/A" : `CPA ${formatRp(totals.advertising.cpa)}`} />
        <MetricCard label="Contribution" value={formatRpShort(totals.contribution_profit)} hint="Profit sebelum iklan" accent="#34D399" />
        <MetricCard label="Net Profit" value={formatRpShort(totals.net_profit)} gold hint="Setelah iklan & HPP" />
        <MetricCard label="Net Margin" value={formatPct(totals.net_margin)} accent={(totals.net_margin ?? 0) >= 0 ? "#34D399" : "#FB7185"} hint={`Target ${totals.target_net_margin_pct}%`} />
        <MetricCard label="ROAS" value={formatX(totals.advertising.roas)} accent="#818CF8" hint={`vs BE ${formatX(totals.be_roas)}`} />
        <MetricCard label="BE ROAS" value={formatX(totals.be_roas)} accent="#FBBF24" hint={`Target ${formatX(totals.target_roas)}`} />
        <MetricCard label="ROI" value={formatPct(totals.business_roi)} accent="#F5D76E" hint="Business ROI, bukan ROAS" />
        <MetricCard label="Ad ROI" value={formatPct(totals.ad_roi)} hint="Profit iklan / spend" />
        <MetricCard label="AOV" value={totals.aov == null ? "N/A" : formatRp(totals.aov)} hint="Net / order" />
        <MetricCard label="Max Ad Cost" value={formatRpShort(totals.max_ad_cost)} hint="Batas rugi per batch" />
        <MetricCard label="Target ROAS" value={formatX(totals.target_roas)} accent="#A78BFA" hint={totals.target_margin_achievable ? "Margin 15%" : "Target tidak tercapai"} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.07] bg-[#101018] p-4 xl:col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A7998]">Revenue vs Ad Spend</p>
          <p className="mb-3 text-[11px] text-[#5A5B7A]">Omzet bersih vs belanja iklan harian — dihitung engine, bukan angka statis.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={daily} barGap={4}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#7A7998", fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fill: "#7A7998", fontSize: 11 }} axisLine={false} tickFormatter={(v) => formatRpShort(Number(v))} width={56} />
                <Tooltip contentStyle={TOOLTIP} formatter={(v) => formatRp(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#A8A7C0" }} />
                <Bar dataKey="revenue" name="Revenue" fill="#6366F1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ad_spend" name="Ad Spend" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#101018] p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A7998]">Decision Summary</p>
          <p className="mb-3 text-[11px] text-[#5A5B7A]">SCALE / OPTIMIZE / STOP dari ROAS vs BE vs Target.</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={decisionPie} dataKey="value" innerRadius={52} outerRadius={84} paddingAngle={3}>
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
                <span className="font-mono">{d.value} campaign</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#101018] p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A7998]">Profit Trend</p>
        <p className="mb-3 text-[11px] text-[#5A5B7A]">Contribution profit (sebelum iklan) vs net profit (setelah iklan).</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={daily}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7A7998", fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: "#7A7998", fontSize: 11 }} axisLine={false} tickFormatter={(v) => formatRpShort(Number(v))} width={56} />
              <Tooltip contentStyle={TOOLTIP} formatter={(v) => formatRp(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#A8A7C0" }} />
              <Line type="monotone" dataKey="contribution" name="Contribution Profit" stroke="#34D399" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="net_profit" name="Net Profit" stroke="#F5D76E" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#F4F3FB]">Campaign Performance</h2>
            <p className="text-[11px] text-[#6B6A85]">Klik status untuk melihat rumus lengkap.</p>
          </div>
          <Link href="/dashboard/profit-engine/campaigns" className="text-xs text-[#F5D76E]">
            Lihat semua kolom →
          </Link>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#101018]">
          <table className="min-w-[860px] w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-[#6B6A85]">
              <tr>
                {["Campaign", "Spend", "Revenue", "Orders", "CPA", "ROAS", "BE ROAS", "Net Profit", "Margin", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-[#E4E3F0]">{c.name}</td>
                  <td className="px-4 py-3 font-mono">{formatRp(c.result.advertising.ad_spend)}</td>
                  <td className="px-4 py-3 font-mono">{formatRp(c.result.revenue.net_revenue)}</td>
                  <td className="px-4 py-3 font-mono">{c.result.quantity}</td>
                  <td className="px-4 py-3 font-mono">{c.result.advertising.cpa == null ? "N/A" : formatRp(c.result.advertising.cpa)}</td>
                  <td className="px-4 py-3 font-mono">{formatX(c.result.advertising.roas)}</td>
                  <td className="px-4 py-3 font-mono">{formatX(c.result.be_roas)}</td>
                  <td className="px-4 py-3 font-mono text-[#F5D76E]">{formatRp(c.result.net_profit)}</td>
                  <td className="px-4 py-3 font-mono">{formatPct(c.result.net_margin)}</td>
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <button type="button" onClick={() => setOpen(totals)} className="text-xs text-[#8B8AA0] underline">
          View calculation — portfolio totals
        </button>
        <Link href="/dashboard/profit-engine/calculator" className="text-xs text-[#A8A7C0]">
          Buka Product Calculator →
        </Link>
      </div>

      {open ? <BreakdownModal result={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function CountBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-2 py-2.5">
      <p className="text-[10px] tracking-wider text-[#6B6A85]">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold" style={{ color }}>{value}</p>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-black/20 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-[#7A7998]">{k}</p>
      <p className="font-mono text-xs text-[#F4F3FB]">{v}</p>
    </div>
  );
}
