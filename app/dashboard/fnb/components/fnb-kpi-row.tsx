"use client";

import { KASIR } from "../lib/kasir-theme";

type Kpi = { label: string; value: string; color: string; sub?: string };

function vividKpiStyle(color: string) {
  const map: Record<string, { bg: string; border: string }> = {
    "#2DD4BF": KASIR.gradient.kpi.omzet,
    "#8B5CF6": KASIR.gradient.kpi.order,
    "#A78BFA": KASIR.gradient.kpi.order,
    "#F59E0B": KASIR.gradient.kpi.laba,
    "#FBBF24": KASIR.gradient.kpi.laba,
    "#38BDF8": { bg: "linear-gradient(145deg, rgba(56,189,248,.24), rgba(56,189,248,.05))", border: "rgba(56,189,248,.38)" },
    "#EC4899": KASIR.gradient.kpi.foodCost,
    "#F472B6": KASIR.gradient.kpi.foodCost,
  };
  return map[color] || KASIR.gradient.kpi.omzet;
}

export default function FnbKpiRow({ items, variant = "default" }: { items: Kpi[]; variant?: "default" | "vivid" }) {
  return (
    <div className="mb-4 w-full min-w-0 max-w-full md:mb-6 -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 scrollbar-none md:mx-0 md:grid md:grid-cols-4 md:gap-3 md:overflow-visible md:px-0 md:pb-0">
      {items.map(k => {
        const vivid = variant === "vivid" ? vividKpiStyle(k.color) : null;
        return (
        <div
          key={k.label}
          className={
            "relative min-w-[7.5rem] flex-shrink-0 overflow-hidden rounded-2xl border p-3.5 md:min-w-0 md:p-4 " +
            (variant === "vivid"
              ? "shadow-[inset_0_1px_0_rgba(255,255,255,.08)]"
              : "border-white/[0.08] bg-[#0F0F1A]/80 backdrop-blur-sm")
          }
          style={vivid ? { background: vivid.bg, borderColor: vivid.border } : undefined}
        >
          {variant === "default" && (
            <div
              className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-20 blur-2xl"
              style={{ background: k.color }}
            />
          )}
          <p className="relative mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#A8A7C0] md:mb-1 md:text-[10px]">{k.label}</p>
          <p className="relative font-mono text-base font-bold md:text-lg" style={{ color: k.color }}>{k.value}</p>
          {k.sub && <p className="relative mt-0.5 text-[10px] text-[#5A5B7A]">{k.sub}</p>}
        </div>
      );})}
    </div>
  );
}
