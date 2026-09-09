"use client";

import { useState } from "react";
import { formatPct, formatRp, formatX } from "@/lib/gercep-profit/format";
import type { ProfitCalcResult } from "@/lib/gercep-profit/types";
import BreakdownModal from "../components/breakdown-modal";
import StatusBadge from "../components/status-badge";

export default function ProductsClient({ rows }: { rows: ProfitCalcResult[] }) {
  const [open, setOpen] = useState<ProfitCalcResult | null>(null);
  return (
    <div>
      <p className="mb-4 text-sm text-[#8B8AA0]">
        Semua angka dihitung engine dari demo product Henima Afternoon — bukan angka statis.
      </p>
      <div className="hidden overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#101018] md:block">
        <table className="min-w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.12em] text-[#6B6A85]">
            <tr>
              {["Product", "Revenue", "COGS", "Marketplace Fee", "Affiliate", "Ad Spend", "Profit", "Margin", "ROAS", "BE ROAS", "Status"].map((h) => (
                <th key={h} className="px-3 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product_name + r.quantity + r.advertising.ad_spend} className="border-t border-white/[0.05]">
                <td className="px-3 py-3 text-[#E4E3F0]">{r.product_name}</td>
                <td className="px-3 py-3 font-mono">{formatRp(r.revenue.net_revenue)}</td>
                <td className="px-3 py-3 font-mono">{formatRp(r.cost.cogs)}</td>
                <td className="px-3 py-3 font-mono">{formatRp(r.platform_fees)}</td>
                <td className="px-3 py-3 font-mono">{formatRp(r.affiliate_fees)}</td>
                <td className="px-3 py-3 font-mono">{formatRp(r.advertising.ad_spend)}</td>
                <td className="px-3 py-3 font-mono text-[#F5D76E]">{formatRp(r.net_profit)}</td>
                <td className="px-3 py-3 font-mono">{formatPct(r.net_margin)}</td>
                <td className="px-3 py-3 font-mono">{formatX(r.advertising.roas)}</td>
                <td className="px-3 py-3 font-mono">{formatX(r.be_roas)}</td>
                <td className="px-3 py-3">
                  <button type="button" onClick={() => setOpen(r)}>
                    <StatusBadge status={r.decision.status} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2.5 md:hidden">
        {rows.map((r) => (
          <button
            key={r.product_name + r.advertising.ad_spend}
            type="button"
            onClick={() => setOpen(r)}
            className="w-full rounded-2xl border border-white/[0.07] bg-[#101018] p-4 text-left"
          >
            <div className="flex justify-between gap-2">
              <p className="text-sm font-medium">{r.product_name}</p>
              <StatusBadge status={r.decision.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[#6B6A85]">Profit</p>
                <p className="font-mono text-[#F5D76E]">{formatRp(r.net_profit)}</p>
              </div>
              <div>
                <p className="text-[#6B6A85]">ROAS / BE</p>
                <p className="font-mono">{formatX(r.advertising.roas)} · {formatX(r.be_roas)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      {open ? <BreakdownModal result={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
