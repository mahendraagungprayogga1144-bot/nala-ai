import type { DecisionStatus } from "@/lib/gercep-profit/types";
import { STATUS_TONE } from "@/lib/gercep-profit/format";

const LABELS: Record<DecisionStatus, string> = {
  SCALE: "SCALE",
  OPTIMIZE: "OPTIMIZE",
  STOP: "STOP",
  PRODUCT_NOT_PROFITABLE: "NOT PROFITABLE",
};

export default function StatusBadge({
  status,
  large,
}: {
  status: DecisionStatus;
  large?: boolean;
}) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide ${
        large ? "px-3.5 py-1.5 text-xs" : "px-2.5 py-1 text-[10px]"
      }`}
      style={{ background: tone.bg, border: `1px solid ${tone.border}`, color: tone.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} />
      {LABELS[status]}
    </span>
  );
}
