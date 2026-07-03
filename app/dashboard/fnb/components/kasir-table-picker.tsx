"use client";
import { MEJA_PRESETS } from "../lib/kasir-order-meta";

export default function KasirTablePicker({
  meja,
  onChange,
  compact,
}: {
  meja: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mb-2" : "mb-3"}>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#8B8AA0]">Meja / order</p>
      <div className="flex flex-wrap gap-1.5">
        {MEJA_PRESETS.map(m => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(meja === m ? "" : m)}
            className={
              "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors " +
              (meja === m
                ? "border-[#2DD4BF]/50 bg-[#2DD4BF]/15 text-[#2DD4BF]"
                : "border-white/10 bg-white/[0.03] text-[#8B8AA0] hover:border-[#2DD4BF]/30")
            }
          >
            {m === "Takeaway" ? "Takeaway" : `M${m}`}
          </button>
        ))}
      </div>
    </div>
  );
}
