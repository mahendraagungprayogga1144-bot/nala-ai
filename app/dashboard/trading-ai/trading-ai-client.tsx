"use client";

import { useState } from "react";
import {
  Activity,
  Crosshair,
  Lock,
  Radar,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  TRADING_AI_VERSION,
  DEFAULT_TRADING_AI_CONFIG,
  decideTradingAction,
  journal,
  type Candle,
  type TradeDecision,
  type TradingDecisionResult,
} from "@/lib/trading-ai";

function candle(i: number, o: number, h: number, l: number, c: number): Candle {
  return { time: 1_700_000_000 + i * 60, open: o, high: h, low: l, close: c };
}

/** Demo M5 bullish structure (enough bars for analyzer). */
function demoBullishM5(): Candle[] {
  const out: Candle[] = [];
  let base = 2300;
  for (let i = 0; i < 60; i++) {
    const wave = Math.sin(i / 4) * 1.2;
    const drift = i * 0.15;
    const mid = base + drift + wave;
    const bull = i % 5 !== 4;
    const o = mid;
    const c = mid + (bull ? 0.6 : -0.35);
    out.push(candle(i, o, Math.max(o, c) + 0.4, Math.min(o, c) - 0.4, c));
  }
  const n = out.length;
  out[n - 12] = candle(n - 12, 2308, 2310, 2307.5, 2309.2);
  out[n - 9] = candle(n - 9, 2309, 2309.5, 2306.8, 2307.2);
  out[n - 6] = candle(n - 6, 2307.5, 2312, 2307.2, 2311.5);
  out[n - 3] = candle(n - 3, 2311, 2311.4, 2308.5, 2309);
  out[n - 1] = candle(n - 1, 2309.2, 2313, 2309, 2312.5);
  return out;
}

/** Demo M1 pullback → rejection → momentum. */
function demoBullishM1(): Candle[] {
  const out: Candle[] = [];
  let px = 2308;
  for (let i = 0; i < 16; i++) {
    const o = px;
    const c = px + 0.5;
    out.push(candle(i, o, c + 0.2, o - 0.1, c));
    px = c;
  }
  while (px > 2308.6) {
    const o = px;
    const c = px - 0.45;
    out.push(candle(out.length, o, Math.max(o, c) + 0.08, Math.min(o, c) - 0.08, c));
    px = c;
  }
  out.push(candle(out.length, 2308.4, 2308.7, 2307.8, 2308.55));
  px = 2308.55;
  for (let i = 0; i < 6; i++) {
    const o = px;
    const c = px + 0.45;
    out.push(candle(out.length, o, c + 0.15, o - 0.05, c));
    px = c;
  }
  out.push(candle(out.length, px, px + 0.1, px - 0.05, px + 0.05));
  return out;
}

function decisionColor(d: TradeDecision) {
  if (d === "BUY") return "#00F0A8";
  if (d === "SELL") return "#FF3D7F";
  if (d === "CLOSE") return "#FFB020";
  return "#5CE1FF";
}

const RULES = [
  "XAUUSD · M5 bias · M1 entry",
  "Price action — bukan RSI/MACD/EMA",
  "M5 bullish → BUY only",
  "M5 bearish → SELL only",
  "Pullback → rejection → momentum",
  "Max 1 posisi · no avg / grid / hedge",
  "Live order OFF · MT5 OFF",
];

export default function TradingAiClient({ userLabel }: { userLabel: string }) {
  const [result, setResult] = useState<TradingDecisionResult | null>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState(journal.listJournal(8));

  const runDemo = () => {
    setRunning(true);
    // Yield so pulse UI paints
    requestAnimationFrame(() => {
      const m1 = demoBullishM1();
      const last = m1[m1.length - 1].close;
      const out = decideTradingAction(
        {
          symbol: "XAUUSD",
          m5Candles: demoBullishM5(),
          m1Candles: m1,
          market: {
            symbol: "XAUUSD",
            bid: last,
            ask: last + 0.2,
            spread: 20,
            at: Date.now(),
          },
          openPositions: [],
        },
        {
          config: {
            ...DEFAULT_TRADING_AI_CONFIG,
            brain: {
              ...DEFAULT_TRADING_AI_CONFIG.brain,
              minConfidenceToEnter: 50,
              pullbackMinDepth: 0.15,
              pullbackMaxDepth: 0.95,
              levelTouchAtrMult: 1.2,
            },
          },
        },
      );
      setResult(out);
      journal.appendJournal(journal.buildJournalEntry(out, { notes: "Demo pulse" }));
      setLog(journal.listJournal(8));
      setRunning(false);
    });
  };

  const d = result?.decision ?? "WAIT";
  const color = decisionColor(d);

  return (
    <div className="cp-root relative min-h-[calc(100vh-2rem)] overflow-hidden px-3 py-4 sm:px-6 sm:py-6">
      <style jsx>{`
        .cp-root {
          --cp-bg: #05060c;
          --cp-panel: rgba(8, 12, 24, 0.82);
          --cp-cyan: #5ce1ff;
          --cp-pink: #ff3d9a;
          --cp-lime: #00f0a8;
          --cp-grid: rgba(92, 225, 255, 0.06);
          background:
            radial-gradient(900px 420px at 8% -10%, rgba(255, 61, 154, 0.16), transparent 55%),
            radial-gradient(800px 380px at 100% 0%, rgba(92, 225, 255, 0.14), transparent 50%),
            linear-gradient(180deg, #070912 0%, #05060c 55%, #04050a 100%);
          color: #e8f7ff;
          font-family: var(--font-geist-mono), ui-monospace, monospace;
        }
        .cp-root::before {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(var(--cp-grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--cp-grid) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: linear-gradient(180deg, #000 0%, transparent 92%);
          animation: cp-grid-drift 28s linear infinite;
        }
        .cp-root::after {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.12) 3px
          );
          opacity: 0.35;
          mix-blend-mode: multiply;
        }
        @keyframes cp-grid-drift {
          from { background-position: 0 0, 0 0; }
          to { background-position: 0 48px, 48px 0; }
        }
        @keyframes cp-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.03); }
        }
        @keyframes cp-scan {
          0% { transform: translateY(-120%); }
          100% { transform: translateY(220%); }
        }
        .cp-panel {
          position: relative;
          background: var(--cp-panel);
          border: 1px solid rgba(92, 225, 255, 0.22);
          box-shadow:
            0 0 0 1px rgba(255, 61, 154, 0.08) inset,
            0 0 40px rgba(92, 225, 255, 0.06);
          backdrop-filter: blur(10px);
        }
        .cp-panel::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--cp-cyan), var(--cp-pink), transparent);
          opacity: 0.7;
        }
        .cp-decision {
          text-shadow: 0 0 24px currentColor, 0 0 48px currentColor;
          animation: cp-pulse 2.4s ease-in-out infinite;
        }
        .cp-scanline {
          position: absolute;
          left: 0;
          right: 0;
          height: 28%;
          background: linear-gradient(
            180deg,
            transparent,
            rgba(92, 225, 255, 0.08),
            transparent
          );
          animation: cp-scan 4.5s linear infinite;
          pointer-events: none;
        }
        .cp-btn {
          background: linear-gradient(135deg, #00e0ff 0%, #7a3cff 55%, #ff3d9a 100%);
          color: #05060c;
          box-shadow: 0 0 28px rgba(92, 225, 255, 0.35);
        }
        .cp-btn:disabled {
          opacity: 0.55;
          box-shadow: none;
        }
        .cp-chip {
          border: 1px solid rgba(92, 225, 255, 0.25);
          background: rgba(92, 225, 255, 0.06);
        }
      `}</style>

      <div className="relative z-[1] mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.35em] text-[#5CE1FF]/80">
              Gercep Neural Desk · v{TRADING_AI_VERSION}
            </p>
            <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#5CE1FF]/40 bg-[#5CE1FF]/10 text-[#5CE1FF]">
                <Crosshair size={20} />
              </span>
              Trading AI Brain
            </h1>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-[#8FB8C9] sm:text-sm">
              Brain XAUUSD mirip gaya manual kamu. Demo pulse memakai candle sintetis —
              belum terhubung MT5, belum bisa order.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest">
            <span className="cp-chip rounded-full px-3 py-1.5 text-[#5CE1FF]">operator {userLabel}</span>
            <span className="cp-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[#FF3D9A]">
              <Lock size={11} /> live off
            </span>
            <span className="cp-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[#00F0A8]">
              <Shield size={11} /> max 1 pos
            </span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Decision hologram */}
          <div className="cp-panel overflow-hidden rounded-2xl p-5 sm:p-7">
            <div className="cp-scanline" />
            <div className="relative z-[1] mb-5 flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#5CE1FF]/70">Decision core</p>
              <span className="text-[10px] text-[#6A8A99]">executable: false</span>
            </div>

            <div className="relative z-[1] mb-6 text-center">
              <p className="mb-2 text-[10px] uppercase tracking-[0.4em] text-[#6A8A99]">output</p>
              <p className="cp-decision text-6xl font-bold tracking-[0.12em] sm:text-7xl" style={{ color }}>
                {d}
              </p>
              <p className="mt-3 text-sm text-[#9BC5D4]">
                confidence{" "}
                <span className="font-semibold text-white">{result?.confidence ?? 0}</span>
                <span className="text-[#6A8A99]"> / 100</span>
              </p>
            </div>

            <button
              type="button"
              onClick={runDemo}
              disabled={running}
              className="cp-btn relative z-[1] mb-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold tracking-wide"
            >
              {running ? (
                <>
                  <Radar size={16} className="animate-spin" /> Scanning neural tape…
                </>
              ) : (
                <>
                  <Zap size={16} /> Jalankan demo pulse
                </>
              )}
            </button>

            <div className="relative z-[1] space-y-2">
              {(result?.reasons || ["Tekan demo pulse untuk menjalankan Brain Engine."]).slice(0, 5).map((r, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-[11px] leading-relaxed text-[#B7D7E4]"
                >
                  <span className="mr-2 text-[#5CE1FF]">›</span>
                  {r}
                </div>
              ))}
            </div>
          </div>

          {/* Side intel */}
          <div className="flex flex-col gap-4">
            <div className="cp-panel rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#FF3D9A]/90">
                <Activity size={13} /> Signal stack
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["M5 trend", result?.trend.direction ?? "—"],
                  ["Pullback", result ? (result.pullback.detected ? "yes" : "no") : "—"],
                  ["Rejection", result ? (result.rejection.detected ? "yes" : "no") : "—"],
                  ["Momentum", result ? (result.momentum.alignedWithTrend ? "aligned" : "wait") : "—"],
                  ["Risk", result ? (result.risk.allowed ? "clear" : "block") : "—"],
                  ["Valid", result ? (result.validation.valid ? "pass" : "fail") : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-white/5 bg-black/25 px-3 py-2.5">
                    <p className="text-[9px] uppercase tracking-wider text-[#6A8A99]">{k}</p>
                    <p className="mt-1 text-sm font-semibold capitalize text-[#E8F7FF]">{v}</p>
                  </div>
                ))}
              </div>
              {result?.entry.suggestedLot != null && (result.decision === "BUY" || result.decision === "SELL") && (
                <div className="mt-3 rounded-xl border border-[#00F0A8]/25 bg-[#00F0A8]/5 px-3 py-2.5 text-[11px] text-[#B8FFE8]">
                  lot {result.entry.suggestedLot}
                  {result.entry.suggestedStopLoss != null && (
                    <> · SL {result.entry.suggestedStopLoss.toFixed(2)}</>
                  )}
                  {result.entry.suggestedTakeProfit != null && (
                    <> · TP {result.entry.suggestedTakeProfit.toFixed(2)}</>
                  )}
                </div>
              )}
            </div>

            <div className="cp-panel rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#5CE1FF]/90">
                <Sparkles size={13} /> Protocol rules
              </div>
              <ul className="space-y-1.5">
                {RULES.map((r) => (
                  <li key={r} className="flex gap-2 text-[11px] text-[#A9C9D6]">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#FF3D9A] shadow-[0_0_8px_#FF3D9A]" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Journal */}
        <div className="cp-panel mt-4 rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#5CE1FF]/80">Session journal</p>
            <p className="text-[10px] text-[#6A8A99]">in-memory · belum ke database</p>
          </div>
          {log.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#6A8A99]">Belum ada jejak. Jalankan demo pulse.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {log.map((e) => (
                <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[11px]">
                  <div className="flex items-center gap-3">
                    <span className="font-bold tracking-wider" style={{ color: decisionColor(e.decision) }}>
                      {e.decision}
                    </span>
                    <span className="text-[#7FA4B3]">{e.contextSummary}</span>
                  </div>
                  <span className="text-[#5A7A88]">conf {e.confidence}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] tracking-wide text-[#4E6A78]">
          Phase UI · demo only · Supported by Gercep AI
        </p>
      </div>
    </div>
  );
}
