"use client";

import { useState } from "react";
import { formatPct, formatRp, formatX } from "@/lib/gercep-profit/format";
import type { DemoCampaign } from "@/lib/gercep-profit/demo";
import type { ProfitCalcResult } from "@/lib/gercep-profit/types";
import BreakdownModal from "../components/breakdown-modal";
import StatusBadge from "../components/status-badge";

export default function CampaignsClient({ campaigns }: { campaigns: DemoCampaign[] }) {
  const [open, setOpen] = useState<ProfitCalcResult | null>(null);
  return (
    <div>
      <p className="mb-4 text-sm text-[#8B8AA0]">
        SCALE / OPTIMIZE / STOP dihasilkan Decision Engine dari ROAS vs BE ROAS vs Target ROAS.
      </p>
      <div className="hidden overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#101018] md:block">
        <table className="min-w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.12em] text-[#6B6A85]">
            <tr>
              {["Campaign", "Product", "Revenue", "Units", "COGS", "CPA", "Fees", "Affiliate", "Variable", "Net Profit", "Margin", "ROAS", "BE ROAS", "Status"].map((h) => (
                <th key={h} className="px-3 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-white/[0.05]">
                <td className="px-3 py-3 text-[#E4E3F0]">{c.name}</td>
                <td className="px-3 py-3">{c.product_name}</td>
                <td className="px-3 py-3 font-mono">{formatRp(c.result.revenue.net_revenue)}</td>
                <td className="px-3 py-3 font-mono">{c.result.quantity}</td>
                <td className="px-3 py-3 font-mono">{formatRp(c.result.cost.cogs)}</td>
                <td className="px-3 py-3 font-mono">{c.result.advertising.cpa == null ? "N/A" : formatRp(c.result.advertising.cpa)}</td>
                <td className="px-3 py-3 font-mono">{formatRp(c.result.platform_fees)}</td>
                <td className="px-3 py-3 font-mono">{formatRp(c.result.affiliate_fees)}</td>
                <td className="px-3 py-3 font-mono">{formatRp(c.result.order_variable_cost)}</td>
                <td className="px-3 py-3 font-mono text-[#F5D76E]">{formatRp(c.result.net_profit)}</td>
                <td className="px-3 py-3 font-mono">{formatPct(c.result.net_margin)}</td>
                <td className="px-3 py-3 font-mono">{formatX(c.result.advertising.roas)}</td>
                <td className="px-3 py-3 font-mono">{formatX(c.result.be_roas)}</td>
                <td className="px-3 py-3">
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
            <div className="flex justify-between gap-2">
              <p className="text-sm font-medium">{c.name}</p>
              <StatusBadge status={c.result.decision.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[#6B6A85]">Net Profit</p>
                <p className="font-mono text-[#F5D76E]">{formatRp(c.result.net_profit)}</p>
              </div>
              <div>
                <p className="text-[#6B6A85]">ROAS / BE</p>
                <p className="font-mono">{formatX(c.result.advertising.roas)} · {formatX(c.result.be_roas)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      {open ? <BreakdownModal result={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
