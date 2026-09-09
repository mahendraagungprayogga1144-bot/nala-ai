export default function MetricCard({
  label,
  value,
  hint,
  accent,
  gold,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  gold?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border border-white/[0.07] p-3.5 sm:p-4"
      style={{
        background: gold
          ? "linear-gradient(165deg, rgba(212,175,55,0.14), #101018 55%)"
          : "#101018",
      }}
    >
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#7A7998]">{label}</p>
      <p
        className="font-mono text-lg font-semibold leading-none sm:text-xl"
        style={{ color: accent || (gold ? "#F5D76E" : "#F4F3FB") }}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[11px] text-[#5A5B7A]">{hint}</p> : null}
    </div>
  );
}
