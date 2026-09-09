"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { applySimulatorKnobs, calculateProfit, simulateAdCostCurve } from "@/lib/gercep-profit/calculate";
import { henimaAfternoonInput } from "@/lib/gercep-profit/demo";
import { formatPct, formatRp, formatRpShort, formatX } from "@/lib/gercep-profit/format";
import StatusBadge from "../components/status-badge";
import BreakdownModal from "../components/breakdown-modal";

export default function SimulatorClient() {
  const [price, setPrice] = useState(150000);
  const [discount, setDiscount] = useState(10);
  const [affiliate, setAffiliate] = useState(10);
  const [platform, setPlatform] = useState(7.5);
  const [hpp, setHpp] = useState(64500);
  const [target, setTarget] = useState(15);
  const [adCost, setAdCost] = useState(15000);
  const [open, setOpen] = useState(false);

  const { result, curve } = useMemo(() => {
    const base = henimaAfternoonInput();
    const input = applySimulatorKnobs(base, {
      selling_price: price,
      discount_pct: discount,
      affiliate_rate: affiliate,
      platform_fee_rate: platform,
      hpp,
      target_net_margin_pct: target,
      ad_cost: adCost,
    });
    const pre = calculateProfit({ ...input, advertising: { ...input.advertising, attributed_revenue: 0, ad_spend: 0 } });
    input.advertising.attributed_revenue = pre.revenue.net_revenue;
    return { result: calculateProfit(input), curve: simulateAdCostCurve(input) };
  }, [price, discount, affiliate, platform, hpp, target, adCost]);

  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-3 rounded-2xl border border-white/[0.07] bg-[#101018] p-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7A7998]">Ad Profit Simulator</h2>
        <Slider label="Selling Price" min={50000} max={300000} step={1000} value={price} onChange={setPrice} format={formatRp} />
        <Slider label="Discount %" min={0} max={50} step={1} value={discount} onChange={setDiscount} format={(n) => `${n}%`} />
        <Slider label="Affiliate %" min={0} max={30} step={0.5} value={affiliate} onChange={setAffiliate} format={(n) => `${n}%`} />
        <Slider label="Platform Fee %" min={0} max={20} step={0.5} value={platform} onChange={setPlatform} format={(n) => `${n}%`} />
        <Slider label="HPP / unit" min={20000} max={120000} step={500} value={hpp} onChange={setHpp} format={formatRp} />
        <Slider label="Target Margin %" min={0} max={40} step={1} value={target} onChange={setTarget} format={(n) => `${n}%`} />
        <label className="block text-xs text-[#8B8AA0]">
          Ad Cost
          <input
            type="range"
            min={5000}
            max={100000}
            step={500}
            value={adCost}
            onChange={(e) => setAdCost(Number(e.target.value))}
            className="mt-2 w-full accent-[#D4AF37]"
          />
          <div className="mt-1 flex justify-between font-mono text-[11px] text-[#6B6A85]">
            <span>Rp5.000</span>
            <span className="text-[#F5D76E]">{formatRp(adCost)}</span>
            <span>Rp100.000</span>
          </div>
        </label>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-white/[0.07] bg-[#101018] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7A7998]">Realtime Result</p>
            <StatusBadge status={result.decision.status} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat k="Net Revenue" v={formatRp(result.revenue.net_revenue)} />
            <Stat k="Contribution Profit" v={formatRp(result.contribution_profit)} />
            <Stat k="Maximum Ad Cost" v={formatRp(result.max_ad_cost)} />
            <Stat k="BE ROAS" v={formatX(result.be_roas)} />
            <Stat k="Target ROAS" v={formatX(result.target_roas)} />
            <Stat k="Est. Net Profit" v={formatRp(result.net_profit)} gold />
            <Stat k="Est. Net Margin" v={formatPct(result.net_margin)} />
            <Stat k="Business ROI" v={formatPct(result.business_roi)} />
          </div>
          <p className="mt-3 text-sm text-[#B8B7C8]">{result.decision.recommendation}</p>
          <button type="button" onClick={() => setOpen(true)} className="mt-3 text-xs text-[#F5D76E] underline">
            View Calculation
          </button>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-[#101018] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A7998]">Profit vs Ad Cost</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="ad_cost" tick={{ fill: "#7A7998", fontSize: 10 }} tickFormatter={(v) => formatRpShort(Number(v))} />
                <YAxis tick={{ fill: "#7A7998", fontSize: 10 }} tickFormatter={(v) => formatRpShort(Number(v))} />
                <Tooltip
                  contentStyle={{ background: "#0A0A12", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => formatRp(Number(v))}
                  labelFormatter={(v) => `Ad ${formatRp(Number(v))}`}
                />
                <Line type="monotone" dataKey="net_profit" stroke="#F5D76E" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      {open ? <BreakdownModal result={result} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
  format: (n: number) => string;
}) {
  return (
    <label className="block text-xs text-[#8B8AA0]">
      <span className="flex justify-between">
        {label}
        <span className="font-mono text-[#F4F3FB]">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[#D4AF37]"
      />
    </label>
  );
}

function Stat({ k, v, gold }: { k: string; v: string; gold?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[#6B6A85]">{k}</p>
      <p className={`font-mono text-sm font-semibold ${gold ? "text-[#F5D76E]" : "text-[#F4F3FB]"}`}>{v}</p>
    </div>
  );
}
