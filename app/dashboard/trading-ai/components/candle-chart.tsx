"use client";

import type { Candle } from "@/lib/trading-ai";

export type ChartOverlay = {
  current?: number | null;
  support?: number | null;
  resistance?: number | null;
  sl?: number | null;
  tp?: number | null;
  entry?: number | null;
  entrySide?: "BUY" | "SELL" | null;
  pullback?: number | null;
  rejection?: number | null;
};

function yScale(price: number, min: number, max: number, h: number, pad: number) {
  const span = Math.max(max - min, 0.01);
  return pad + ((max - price) / span) * (h - pad * 2);
}

export default function CandleChart({
  title,
  live,
  candles,
  overlay,
  emptyHint,
}: {
  title: string;
  live: boolean;
  candles: Candle[];
  overlay?: ChartOverlay;
  emptyHint: string;
}) {
  const w = 640;
  const h = 220;
  const pad = 10;
  if (candles.length < 2) {
    return (
      <div className="flex h-[220px] flex-col border border-white/[0.08] bg-black/40 px-3 py-2">
        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.22em]">
          <span className="text-[#8FB8C9]">{title}</span>
          <span className="text-[#6A8A99]">WAITING DATA</span>
        </div>
        <p className="m-auto max-w-sm text-center text-[11px] leading-relaxed text-[#6A8A99]">
          {emptyHint}
        </p>
      </div>
    );
  }

  const slice = candles.slice(-80);
  const highs = slice.map((c) => c.high);
  const lows = slice.map((c) => c.low);
  let min = Math.min(...lows);
  let max = Math.max(...highs);
  const extras = [
    overlay?.current,
    overlay?.support,
    overlay?.resistance,
    overlay?.sl,
    overlay?.tp,
    overlay?.entry,
  ].filter((n): n is number => n != null && Number.isFinite(n));
  for (const n of extras) {
    min = Math.min(min, n);
    max = Math.max(max, n);
  }
  const padPx = (max - min) * 0.08 || 0.4;
  min -= padPx;
  max += padPx;
  const slot = (w - pad * 2) / slice.length;
  const last = slice[slice.length - 1];
  const lastUp = last.close >= last.open;

  const lines: { price: number; color: string; dash?: boolean; label: string }[] = [];
  if (overlay?.support != null) lines.push({ price: overlay.support, color: "#00F0A8", dash: true, label: "S" });
  if (overlay?.resistance != null) {
    lines.push({ price: overlay.resistance, color: "#FF3D7F", dash: true, label: "R" });
  }
  if (overlay?.sl != null) lines.push({ price: overlay.sl, color: "#FF3D7F", label: "SL" });
  if (overlay?.tp != null) lines.push({ price: overlay.tp, color: "#00F0A8", label: "TP" });
  if (overlay?.entry != null) {
    lines.push({
      price: overlay.entry,
      color: overlay.entrySide === "SELL" ? "#FF3D7F" : "#5CE1FF",
      label: "ENTRY",
    });
  }
  if (overlay?.current != null) {
    lines.push({ price: overlay.current, color: "#E8F7FF", label: last.close.toFixed(3) });
  }

  return (
    <div className="border border-white/[0.08] bg-black/40">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8FB8C9]">{title}</p>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          {live ? (
            <span className="text-[#00F0A8]">LIVE</span>
          ) : (
            <span className="text-[#FFB14A]">STALE</span>
          )}
          <span className={lastUp ? "text-[#00F0A8]" : "text-[#FF3D7F]"}>{last.close.toFixed(3)}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-[220px] w-full" role="img" aria-label={title}>
        {lines.map((ln) => {
          const y = yScale(ln.price, min, max, h, pad);
          return (
            <g key={ln.label + ln.price}>
              <line
                x1={pad}
                x2={w - pad}
                y1={y}
                y2={y}
                stroke={ln.color}
                strokeWidth={ln.label === last.close.toFixed(3) ? 1.2 : 0.8}
                strokeDasharray={ln.dash ? "4 3" : undefined}
                opacity={0.85}
              />
              <text x={w - pad - 2} y={y - 3} textAnchor="end" fill={ln.color} fontSize="8" fontFamily="ui-monospace, monospace">
                {ln.label}
              </text>
            </g>
          );
        })}
        {slice.map((c, i) => {
          const x = pad + i * slot + slot / 2;
          const up = c.close >= c.open;
          const color = up ? "#00F0A8" : "#FF3D7F";
          const yO = yScale(c.open, min, max, h, pad);
          const yC = yScale(c.close, min, max, h, pad);
          const yH = yScale(c.high, min, max, h, pad);
          const yL = yScale(c.low, min, max, h, pad);
          const bodyTop = Math.min(yO, yC);
          const bodyH = Math.max(Math.abs(yC - yO), 1.1);
          const cw = Math.max(1.4, Math.min(6, slot * 0.62));
          return (
            <g key={c.time}>
              <line x1={x} x2={x} y1={yH} y2={yL} stroke={color} strokeWidth={0.9} />
              <rect x={x - cw / 2} y={bodyTop} width={cw} height={bodyH} fill={color} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
