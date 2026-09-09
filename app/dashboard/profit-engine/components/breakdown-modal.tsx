"use client";

import { formatFormula, formatRp, formatX } from "@/lib/gercep-profit/format";
import type { ProfitCalcResult } from "@/lib/gercep-profit/types";

export default function BreakdownModal({
  result,
  onClose,
}: {
  result: ProfitCalcResult;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#05050C]/70 p-4 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Tutup" onClick={onClose} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0E0E1A] p-5 shadow-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A7998]">View Calculation</p>
        <h3 className="mt-1 text-lg font-semibold text-[#F4F3FB]">{result.product_name}</h3>
        <p className="text-xs text-[#7A7998]">
          {result.marketplace} · {result.sku || "no SKU"}
        </p>

        <div className="mt-4 space-y-2">
          {result.breakdown.map((line) => (
            <div
              key={line.key}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                line.op === "equals"
                  ? "border border-[#2DD4BF]/25 bg-[#2DD4BF]/10 font-semibold"
                  : "bg-white/[0.03]"
              }`}
            >
              <span className="text-[#A8A7C0]">
                {line.op === "minus" ? "− " : line.op === "equals" ? "= " : ""}
                {line.label}
              </span>
              <span className="font-mono text-[#F4F3FB]">{formatRp(line.amount)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-white/[0.08] bg-[#0A0A12] p-3 text-xs leading-relaxed text-[#9B9AB5]">
          <p className="mb-1 font-semibold text-[#C4C3D6]">BE ROAS</p>
          <p className="font-mono text-[#F4F3FB]">
            {result.be_roas == null
              ? "N/A — contribution profit ≤ 0"
              : formatFormula(
                  formatRp(result.revenue.net_revenue),
                  formatRp(result.contribution_profit),
                  formatX(result.be_roas),
                )}
          </p>
          <p className="mt-2 mb-1 font-semibold text-[#C4C3D6]">ROAS vs ROI</p>
          <p>
            ROAS {formatX(result.advertising.roas)} adalah omzet iklan ÷ spend. Business ROI{" "}
            {result.business_roi == null ? "N/A" : `${result.business_roi.toFixed(1)}%`} memakai net
            profit ÷ modal. Keduanya tidak boleh disamakan.
          </p>
        </div>

        {result.applied_fees.length > 0 && (
          <div className="mt-3 text-xs text-[#8B8AA0]">
            <p className="mb-1 font-semibold text-[#C4C3D6]">Fee rules terpakai ({result.as_of})</p>
            {result.applied_fees.map((f) => (
              <p key={f.fee_name + f.rate}>
                {f.fee_name} {f.rate}% × {formatRp(f.base_amount)} = {formatRp(f.amount)}
              </p>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl border border-white/10 py-2.5 text-sm text-[#E4E3F0]"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
