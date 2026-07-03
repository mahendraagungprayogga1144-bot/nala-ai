"use client";

type Kpi = { label: string; value: string; color: string; sub?: string };

export default function FnbKpiRow({ items }: { items: Kpi[] }) {
  return (
    <div className="mb-4 md:mb-6 -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 scrollbar-none md:mx-0 md:grid md:grid-cols-4 md:gap-3 md:overflow-visible md:px-0 md:pb-0">
      {items.map(k => (
        <div
          key={k.label}
          className="relative min-w-[7.5rem] flex-shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0F0F1A]/80 p-3.5 backdrop-blur-sm md:min-w-0 md:p-4"
        >
          <div
            className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-20 blur-2xl"
            style={{ background: k.color }}
          />
          <p className="relative mb-0.5 text-[9px] font-medium uppercase tracking-wide text-[#8B8AA0] md:mb-1 md:text-[10px]">{k.label}</p>
          <p className="relative font-mono text-base font-bold md:text-lg" style={{ color: k.color }}>{k.value}</p>
          {k.sub && <p className="relative mt-0.5 text-[10px] text-[#5A5B7A]">{k.sub}</p>}
        </div>
      ))}
    </div>
  );
}
