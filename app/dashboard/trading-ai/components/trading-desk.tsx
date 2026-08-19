"use client";

import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Crosshair,
  History,
  LayoutDashboard,
  LineChart,
  Radio,
  Settings,
  ShieldAlert,
  User,
} from "lucide-react";
import type { Candle, LiveActivity, TradingDecisionResult } from "@/lib/trading-ai";
import { HARD_RULES, TRADING_AI_VERSION } from "@/lib/trading-ai";
import type { DeskOpenPosition, PipelineStep, WhyBullet } from "@/lib/trading-ai/quant-desk";
import CandleChart from "./candle-chart";

export const DESK_NAV = [
  { id: "desk", label: "Dashboard", icon: LayoutDashboard },
  { id: "otak", label: "Otak MetaTrader", icon: Crosshair },
  { id: "signal", label: "Signal AI", icon: Radio },
  { id: "posisi", label: "Posisi Aktif", icon: Activity },
  { id: "riwayat", label: "Riwayat Trade", icon: History },
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "backtest", label: "Backtest", icon: LineChart },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Pengaturan", icon: Settings },
] as const;

function na(v: string | number | null | undefined) {
  if (v == null || v === "") return "N/A";
  return String(v);
}

function pnlClass(n: number | null | undefined) {
  if (n == null) return "text-[#9BC5D4]";
  if (n > 0) return "text-[#00F0A8]";
  if (n < 0) return "text-[#FF3D7F]";
  return "text-[#9BC5D4]";
}

function stepClass(status: PipelineStep["status"]) {
  if (status === "ACTIVE") return "border-[#A78BFA]/50 bg-[#A78BFA]/15 text-[#C4B5FD]";
  if (status === "PASSED") return "border-[#00F0A8]/45 bg-[#00F0A8]/10 text-[#00F0A8]";
  if (status === "BLOCKED") return "border-[#FFB14A]/45 bg-[#FFB14A]/12 text-[#FFB14A]";
  if (status === "ERROR") return "border-[#FF3D7F]/45 bg-[#FF3D7F]/12 text-[#FF3D7F]";
  return "border-white/[0.08] bg-black/30 text-[#5A7A88]";
}

function stepMark(status: PipelineStep["status"]) {
  if (status === "PASSED") return "✓";
  if (status === "ACTIVE") return "●";
  if (status === "BLOCKED") return "!";
  if (status === "ERROR") return "×";
  return "○";
}

function Panel({
  id,
  title,
  tone,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  tone?: "cyan" | "pink" | "lime" | "amber" | "purple";
  children: ReactNode;
  className?: string;
}) {
  const color =
    tone === "pink"
      ? "text-[#FF3D7F]"
      : tone === "lime"
        ? "text-[#00F0A8]"
        : tone === "amber"
          ? "text-[#FFB14A]"
          : tone === "purple"
            ? "text-[#C4B5FD]"
            : "text-[#5CE1FF]";
  return (
    <section
      id={id}
      className={`border border-white/[0.09] bg-[#070B12]/90 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-1.5">
        <p className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${color}`}>{title}</p>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 border border-white/[0.07] bg-black/35 px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-[0.16em] text-[#6A8A99]">{label}</p>
      <p className={`mt-0.5 break-all font-mono text-[15px] font-semibold leading-tight ${tone || "text-[#E8F7FF]"}`}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 break-words text-[10px] leading-snug text-[#5A7A88]">{sub}</p> : null}
    </div>
  );
}

export type DeskKpis = {
  totalPnl: number | null;
  realized: number | null;
  floating: number | null;
  equity: number | null;
  balance: number | null;
  winRate: number | null;
  trades: number;
  avgWin: number | null;
  avgLoss: number | null;
  profitFactor: number | null;
  maxDd: number | null;
  risk: number | null;
  riskLabel: string;
};

export type DeskAnalytics = {
  d7: number;
  d30: number;
  d90: number;
};

export type JournalViewRow = {
  id: number;
  time: string;
  symbol: string;
  type: string;
  lot: string;
  entry: string;
  exit: string;
  pips: string;
  pnl: string;
  duration: string;
  reason: string;
  status: string;
};

export type DeskView = {
  userLabel: string;
  serverTime: string;
  gmtLabel: string;
  connection: string;
  accountMode: string;
  login: string;
  broker: string;
  server: string;
  decision: string;
  decisionColor: string;
  confidence: number;
  minConfidence: number;
  openHint: string;
  kpis: DeskKpis;
  openPos: DeskOpenPosition | null;
  posCount: string;
  currentPrice: number | null;
  floating: number | null;
  floatingPts: number | null;
  duration: string;
  spreadPts: number | null;
  m5Bias: string;
  m5Strength: string;
  directionalBias: string;
  m1State: string;
  m1Momentum: string;
  entryQuality: string;
  exitStatus: string;
  targetStatus: string;
  longHold: boolean;
  stale: boolean;
  staleReason: string;
  lastEaSignal: string;
  bid: string;
  ask: string;
  regime: string;
  support: string;
  resistance: string;
  liveM5: Candle[];
  liveM1: Candle[];
  feedLive: boolean;
  brain: {
    pullback: string;
    rejection: string;
    riskGate: string;
    final: string;
    reason: string;
  };
  why: { headline: string; bullets: WhyBullet[] };
  pipeline: PipelineStep[];
  healthRows: { label: string; state: string; age: string }[];
  diagnostic: Record<string, string>;
  tree: { id: string; label: string; on: boolean; sub: string }[];
  features: { id: string; label: string; passed: boolean; points: number }[];
  analytics: DeskAnalytics;
  journal: JournalViewRow[];
  result: TradingDecisionResult | null;
  activity: LiveActivity;
  autotrade: boolean;
  liveEnable: boolean;
  killSwitch: boolean;
  cooldown: string;
  lot: string;
  safetyNote: string;
  aiActive: boolean;
};

function healthTone(state: string) {
  const s = state.toUpperCase();
  if (s === "CONNECTED" || s === "ACTIVE" || s === "READY" || s === "PASSED") return "text-[#00F0A8]";
  if (s === "WARNING" || s === "CONNECTING" || s === "STALE") return "text-[#FFB14A]";
  if (s === "ERROR" || s === "DISCONNECTED" || s === "TIMEOUT") return "text-[#FF3D7F]";
  return "text-[#9BC5D4]";
}

export default function TradingDesk({
  view,
  execution,
  backtest,
  settings,
  explain,
}: {
  view: DeskView;
  execution: ReactNode;
  backtest: ReactNode;
  settings: ReactNode;
  explain: ReactNode;
}) {
  const overlay = {
    current: view.currentPrice,
    support: view.result?.supportResistance.nearestSupport ?? null,
    resistance: view.result?.supportResistance.nearestResistance ?? null,
    sl: view.result?.entry.suggestedStopLoss ?? null,
    tp: view.result?.entry.suggestedTakeProfit ?? null,
    entry: view.openPos?.entryPrice ?? null,
    entrySide: view.openPos?.side ?? null,
    pullback: view.result?.pullback.nearLevel ?? null,
    rejection: view.result?.rejection.atPrice ?? null,
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="tq-root flex min-h-[calc(100dvh-3.5rem)] bg-[#05070C] text-[#E8F7FF] md:min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[168px] shrink-0 flex-col border-r border-white/[0.08] bg-[#05070C] lg:flex">
        <div className="border-b border-white/[0.08] px-3 py-3">
          <p className="text-[10px] font-bold tracking-[0.28em] text-[#5CE1FF]">GERCEP OS</p>
          <p className="mt-0.5 text-[11px] font-semibold text-white">TRADING AI</p>
          <p className="mt-2 font-mono text-[9px] text-[#5A7A88]">v{TRADING_AI_VERSION}</p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {DESK_NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => scrollTo(n.id)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] text-[#8FB8C9] hover:bg-white/[0.04] hover:text-white"
            >
              <n.icon size={13} />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/[0.08] px-3 py-2">
          <p className="text-[9px] uppercase tracking-[0.18em] text-[#A78BFA]">Mode SCALPING</p>
          <p className="mt-1 text-[9px] text-[#5A7A88]">max {HARD_RULES.MAX_POSITION} pos · local swing</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-[#1c2430] bg-[#03050a] px-3 py-1.5">
          <div className="mr-2">
            <p className="text-[9px] font-bold tracking-[0.32em] text-[#5CE1FF]">GERCEP OS</p>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white">TRADING AI</p>
          </div>
          <span className="font-mono text-[10px] text-[#8FB8C9]">
            SERVER {view.serverTime} {view.gmtLabel}
          </span>
          <span className={`font-mono text-[10px] font-bold ${healthTone(view.connection)}`}>
            MT5 {view.connection}
          </span>
          <span className={`font-mono text-[10px] ${view.accountMode === "REAL" ? "text-[#FFB14A]" : "text-[#5CE1FF]"}`}>
            {view.accountMode}
          </span>
          <span className="font-mono text-[10px] text-[#6A8A99]">BROKER {view.broker}</span>
          <span className="font-mono text-[10px] text-[#6A8A99]">SERVER {view.server}</span>
          <span className="font-mono text-[10px] text-[#8FB8C9]">LOGIN {view.login}</span>
          <span className="ml-auto flex items-center gap-2 font-mono text-[10px] text-[#8FB8C9]">
            <User size={12} />
            {view.userLabel}
          </span>
        </header>

        <div className="flex-1 space-y-2 overflow-y-auto p-2 pb-14">
          {view.stale ? (
            <div className="flex items-center justify-between border border-[#FFB14A]/50 bg-[#FFB14A]/12 px-3 py-1.5">
              <p className="text-[11px] font-bold tracking-[0.2em] text-[#FFB14A]">STALE</p>
              <p className="text-[11px] text-[#FFD9A0]">{view.staleReason}</p>
            </div>
          ) : null}

          <div id="desk" className="grid grid-cols-2 gap-1 sm:grid-cols-5 xl:grid-cols-10">
            {(
              [
                ["TODAY PNL", view.kpis.totalPnl, view.kpis.totalPnl == null ? "N/A" : "est. floating", "money"],
                ["REALIZED PNL", view.kpis.realized, "no exit P/L yet", "money"],
                ["FLOATING PNL", view.kpis.floating, view.openPos ? "fill vs last M1" : "flat", "money"],
                ["EQUITY", view.kpis.equity, "no account feed", "money"],
                ["BALANCE", view.kpis.balance, "no account feed", "money"],
                ["WIN RATE", view.kpis.winRate, "need close P/L", "pct"],
                ["TRADES", view.kpis.trades, "EA fills", "count"],
                ["PROFIT FACTOR", view.kpis.profitFactor, "N/A", "num"],
                ["MAX DD", view.kpis.maxDd, "N/A", "money"],
                ["CURRENT RISK", view.kpis.risk, view.kpis.riskLabel, "risk"],
              ] as const
            ).map(([label, value, sub, kind]) => {
              let display = "N/A";
              if (typeof value === "number") {
                if (kind === "money") display = `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
                else if (kind === "pct") display = `${value.toFixed(1)}%`;
                else if (kind === "risk") display = `${value.toFixed(1)} / 10`;
                else display = String(value);
              }
              const tone =
                kind === "risk"
                  ? "text-[#C4B5FD]"
                  : kind === "money" || kind === "pct"
                    ? pnlClass(typeof value === "number" ? value : null)
                    : undefined;
              return <Metric key={label} label={label} value={display} sub={sub} tone={tone} />;
            })}
          </div>

          <div className="grid gap-2 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.4fr)]">
            <Panel id="posisi" title="Posisi Aktif" tone="lime">
              {view.openPos ? (
                <div className="space-y-2">
                    <div className="border border-[#FFB14A]/40 bg-[#FFB14A]/10 px-2 py-1 text-[10px] leading-snug text-[#FFD9A0]">
                      Jurnal EA FILLED — bukan tab Transaksi MT5. Kalau MT5 kosong, posisi ini ghost.
                    </div>
                    {view.longHold ? (
                      <div className="border border-[#FFB14A]/50 bg-[#FFB14A]/15 px-2 py-1 text-[10px] font-bold tracking-[0.16em] text-[#FFB14A]">
                        LONG HOLD WARNING · {view.duration} · scalp M1 tidak menahan berjam-jam
                      </div>
                    ) : null}
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <p className="font-mono text-[10px] text-[#6A8A99]">XAUUSDm</p>
                      <p
                        className="text-4xl font-black tracking-tight"
                        style={{ color: view.openPos.side === "SELL" ? "#FF3D7F" : "#00F0A8" }}
                      >
                        {view.openPos.side}{" "}
                        {view.openPos.lot != null ? view.openPos.lot.toFixed(2) : "N/A"}
                      </p>
                    </div>
                    <div className="border border-[#A78BFA]/40 bg-[#A78BFA]/10 px-2 py-1 text-right">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-[#C4B5FD]">Limit</p>
                      <p className="font-mono text-xl font-bold text-[#C4B5FD]">{view.posCount}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                    <Metric label="ENTRY" value={na(view.openPos.entryPrice?.toFixed(3))} />
                    <Metric label="CURRENT" value={na(view.currentPrice?.toFixed(3))} />
                    <Metric
                      label="FLOATING"
                      value={view.floating == null ? "N/A" : `${view.floating >= 0 ? "+" : ""}${view.floating.toFixed(2)}`}
                      tone={pnlClass(view.floating)}
                    />
                    <Metric
                      label="POINTS"
                      value={view.floatingPts == null ? "N/A" : String(view.floatingPts)}
                      tone={pnlClass(view.floatingPts)}
                    />
                    <Metric label="DURATION" value={view.duration} tone={view.longHold ? "text-[#FFB14A]" : undefined} />
                    <Metric label="SPREAD" value={na(view.spreadPts)} />
                    <Metric label="M5 BIAS" value={view.m5Bias} />
                    <Metric label="M1 MOMENTUM" value={view.m1Momentum} />
                    <Metric label="ENTRY QUALITY" value={view.entryQuality} tone="text-[#C4B5FD]" />
                    <Metric label="EXIT STATUS" value={view.exitStatus} />
                    <Metric label="TARGET STATUS" value={view.targetStatus} />
                    <Metric label="CURRENT EXIT STATE" value={view.exitStatus} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 py-8">
                  <p className="text-sm tracking-[0.18em] text-[#6A8A99]">NO ACTIVE POSITION</p>
                  <p className="font-mono text-xs text-[#A78BFA]">POSITION LIMIT {view.posCount}</p>
                </div>
              )}
            </Panel>

            <div id="charts" className="min-w-0 space-y-2">
              <CandleChart
                title="M5 CHART · XAUUSDm · PRIMARY"
                live={view.feedLive}
                candles={view.liveM5}
                overlay={overlay}
                height={280}
                emptyHint="Candle M5 belum masuk. Jalankan GercepCandlePush di chart M5."
              />
              <CandleChart
                title="M1 CHART · execution detail"
                live={view.feedLive}
                candles={view.liveM1}
                overlay={overlay}
                height={168}
                emptyHint="Candle M1 belum masuk. Jalankan GercepCandlePush di chart M1."
              />
            </div>
          </div>

          <div className="grid gap-2 xl:grid-cols-[1.1fr_0.85fr_0.9fr]">
            <Panel id="otak" title="Trading Brain" tone="purple">
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                <Metric label="MARKET REGIME" value={view.regime} tone="text-[#C4B5FD]" />
                <Metric label="DIRECTIONAL BIAS" value={view.directionalBias} tone="text-[#C4B5FD]" />
                <Metric label="M5 BIAS" value={view.m5Bias} />
                <Metric label="M5 STRENGTH" value={view.m5Strength} />
                <Metric label="M1 STATE" value={view.m1State} />
                <Metric label="PULLBACK" value={view.brain.pullback} />
                <Metric label="REJECTION" value={view.brain.rejection} />
                <Metric label="MOMENTUM" value={view.m1Momentum} />
                <Metric label="SUPPORT" value={view.support} />
                <Metric label="RESISTANCE" value={view.resistance} />
                <Metric label="SPREAD" value={view.spreadPts == null ? "N/A" : `${view.spreadPts}`} />
                <Metric label="RISK GATE" value={view.brain.riskGate} />
                <Metric label="POSITION LIMIT" value={view.posCount} />
                <Metric label="ENTRY QUALITY" value={view.stale ? "STALE" : view.entryQuality} />
              </div>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-[#1c2430] pt-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#6A8A99]">Final decision</p>
                  <p className="text-5xl font-black tracking-tight" style={{ color: view.decisionColor }}>
                    {view.stale ? "WAIT" : view.decision}
                  </p>
                  <p className="mt-1 font-mono text-sm text-[#C4B5FD]">{view.brain.final}</p>
                </div>
                {view.stale ? (
                  <span className="border border-[#FFB14A]/50 bg-[#FFB14A]/15 px-3 py-1 text-[11px] font-bold tracking-[0.2em] text-[#FFB14A]">
                    STALE
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[#9BC5D4]">
                REASON: {view.brain.reason}
              </p>
              <p className="mt-1 text-[10px] text-[#5A7A88]">Last EA snapshot: {view.lastEaSignal}</p>
            </Panel>

            <Panel id="signal" title="Why this signal?" tone="cyan">
              <p className="mb-2 text-xs font-semibold text-white">{view.why.headline}</p>
              <ul className="space-y-1">
                {view.why.bullets.slice(0, 8).map((b, i) => (
                  <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-[#B7D7E4]">
                    <span className={b.ok ? "text-[#00F0A8]" : "text-[#FFB14A]"}>{b.ok ? "▸" : "·"}</span>
                    {b.text}
                  </li>
                ))}
              </ul>
              {explain}
            </Panel>

            <Panel title="Live diagnostic" tone="amber">
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(view.diagnostic).map(([k, v]) => (
                  <Metric
                    key={k}
                    label={k}
                    value={v}
                    tone={String(v).startsWith("STALE") || v === "STALE" ? "text-[#FFB14A]" : undefined}
                  />
                ))}
              </div>
            </Panel>
          </div>

          <Panel title="Execution pipeline">
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
              {view.pipeline.map((s) => (
                <div key={s.id} className={`border px-2 py-2 text-center ${stepClass(s.status)}`}>
                  <p className="font-mono text-[9px]">{s.n}</p>
                  <p className="text-[11px] font-bold">{s.label}</p>
                  <p className="mt-1 font-mono text-[10px]">
                    {stepMark(s.status)} {s.status}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-[#9BC5D4]">{view.openHint}</p>
          </Panel>

          <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr_0.9fr]">
            <Panel title="System health" tone="lime">
              <div className="space-y-1.5">
                {view.healthRows.map((h) => (
                  <div key={h.label} className="flex items-center justify-between border border-white/[0.06] bg-black/30 px-2 py-1.5 text-[11px]">
                    <span className="text-[#8FB8C9]">{h.label}</span>
                    <span className={`font-mono ${healthTone(h.state)}`}>
                      {h.state}
                      {h.age !== "—" ? ` · ${h.age}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Strategy decision tree" tone="cyan">
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[#6A8A99]">every trade traced</p>
              <div className="flex flex-wrap items-center gap-1">
                {view.tree.map((n, i) => (
                  <div key={n.id} className="flex items-center gap-1">
                    {i > 0 ? <span className="text-[#5A7A88]">↓</span> : null}
                    <div
                      className={`min-w-[4.6rem] border px-2 py-1.5 ${
                        n.on ? "border-[#5CE1FF]/40 bg-[#5CE1FF]/10 text-[#5CE1FF]" : "border-white/[0.08] text-[#5A7A88]"
                      }`}
                    >
                      <p className="text-[9px] font-bold uppercase">{n.label}</p>
                      <p className="font-mono text-[10px] text-[#E8F7FF]">{n.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              {view.features.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-1">
                  {view.features.map((f) => (
                    <div
                      key={f.id}
                      className={`border px-2 py-1 text-[10px] ${
                        f.passed ? "border-[#00F0A8]/30 text-[#00F0A8]" : "border-[#FF3D7F]/30 text-[#FFC2D8]"
                      }`}
                    >
                      {f.passed ? "OK" : "MISS"} {f.points}pt · {f.label}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-[#6A8A99]">Feature matrix menunggu feed M1/M5 cukup.</p>
              )}
            </Panel>

            <Panel title="Today PnL">
              <Metric
                label="REALIZED"
                value={view.kpis.realized == null ? "N/A" : view.kpis.realized.toFixed(2)}
                tone={pnlClass(view.kpis.realized)}
              />
              <div className="mt-1.5">
                <Metric
                  label="FLOATING"
                  value={
                    view.kpis.floating == null
                      ? "N/A"
                      : `${view.kpis.floating >= 0 ? "+" : ""}${view.kpis.floating.toFixed(2)}`
                  }
                  tone={pnlClass(view.kpis.floating)}
                />
              </div>
              <div className="mt-1.5">
                <Metric
                  label="TOTAL"
                  value={view.kpis.totalPnl == null ? "N/A" : `${view.kpis.totalPnl >= 0 ? "+" : ""}${view.kpis.totalPnl.toFixed(2)}`}
                  tone={pnlClass(view.kpis.totalPnl)}
                />
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-[#5A7A88]">
                Mini chart P/L intraday: NOT AVAILABLE — jurnal EA belum menyimpan exit price / P/L.
              </p>
            </Panel>
          </div>

          <div id="analytics" className="grid gap-3 xl:grid-cols-2">
            <Panel title="Performance horizon" tone="purple">
              <div className="grid grid-cols-3 gap-1.5">
                <Metric label="7D FILLS" value={String(view.analytics.d7)} />
                <Metric label="30D FILLS" value={String(view.analytics.d30)} />
                <Metric label="90D FILLS" value={String(view.analytics.d90)} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                <Metric label="WIN RATE" value="N/A" />
                <Metric label="PROFIT FACTOR" value="N/A" />
                <Metric label="EXPECTANCY" value="N/A" />
                <Metric label="MAX DD" value="N/A" />
                <Metric label="AVG WIN" value="N/A" />
                <Metric label="AVG LOSS" value="N/A" />
              </div>
              <p className="mt-2 text-[10px] text-[#5A7A88]">
                Count dari jurnal fills sungguhan. Metrik P/L N/A sampai EA kirim exit/P/L.
              </p>
            </Panel>
            <Panel title="Monte Carlo significance">
              <p className="py-8 text-center text-[11px] tracking-[0.18em] text-[#6A8A99]">NOT AVAILABLE</p>
              <p className="text-center text-[10px] text-[#5A7A88]">
                Backend Monte Carlo belum ada. Tidak ada angka simulasi palsu.
              </p>
            </Panel>
          </div>

          <Panel id="journal" title="Live trading journal">
            {view.journal.length === 0 ? (
              <p className="py-4 text-[11px] text-[#6A8A99]">Belum ada baris jurnal dari EA.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left font-mono text-[10px]">
                  <thead className="text-[#6A8A99]">
                    <tr>
                      {"TIME SYMBOL TYPE LOT ENTRY EXIT PIPS P/L DURATION REASON"
                        .split(" ")
                        .map((h) => (
                          <th key={h} className="border-b border-white/[0.06] px-2 py-1.5 font-medium">
                            {h}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {view.journal.map((r) => (
                      <tr key={r.id} className="text-[#D5EAF2]">
                        <td className="border-b border-white/[0.04] px-2 py-1.5 whitespace-nowrap">{r.time}</td>
                        <td className="border-b border-white/[0.04] px-2 py-1.5">{r.symbol}</td>
                        <td
                          className="border-b border-white/[0.04] px-2 py-1.5"
                          style={{
                            color:
                              r.type === "SELL" ? "#FF3D7F" : r.type === "BUY" ? "#00F0A8" : undefined,
                          }}
                        >
                          {r.type}
                        </td>
                        <td className="border-b border-white/[0.04] px-2 py-1.5">{r.lot}</td>
                        <td className="border-b border-white/[0.04] px-2 py-1.5">{r.entry}</td>
                        <td className="border-b border-white/[0.04] px-2 py-1.5">{r.exit}</td>
                        <td className="border-b border-white/[0.04] px-2 py-1.5">{r.pips}</td>
                        <td className="border-b border-white/[0.04] px-2 py-1.5">{r.pnl}</td>
                        <td className="border-b border-white/[0.04] px-2 py-1.5">{r.duration}</td>
                        <td className="border-b border-white/[0.04] px-2 py-1.5">{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div id="riwayat">{execution}</div>
          <div id="backtest">{backtest}</div>
          <div id="settings">{settings}</div>
        </div>

        <footer className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.1] bg-[#05070C]/95 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em]">
          <div className="flex flex-wrap items-center gap-2">
            <span className={view.aiActive ? "border border-[#00F0A8]/40 bg-[#00F0A8]/15 px-2 py-0.5 text-[#00F0A8]" : "border border-white/15 px-2 py-0.5 text-[#6A8A99]"}>
              STATUS AI {view.aiActive ? "ACTIVE" : "INACTIVE"}
            </span>
            <span className={view.autotrade ? "text-[#00F0A8]" : "text-[#6A8A99]"}>
              AUTO {view.autotrade ? "ON" : "OFF"}
            </span>
            <span className={view.killSwitch ? "text-[#FF3D7F]" : "text-[#6A8A99]"}>
              KILL SWITCH {view.killSwitch ? "ON" : "OFF"}
            </span>
            <span className={view.liveEnable ? "text-[#FFB14A]" : "text-[#6A8A99]"}>
              LIVE ENABLE {view.liveEnable ? "ON" : "OFF"}
            </span>
            <span className="text-[#A78BFA]">MODE SCALPING</span>
            <span className="text-[#5CE1FF]">{view.accountMode}</span>
            <span className="text-[#6A8A99]">CD {view.cooldown} · LOT {view.lot}</span>
          </div>
          <p className={`flex items-center gap-1 ${view.autotrade ? "text-[#00F0A8]" : "text-[#FFB14A]"}`}>
            <ShieldAlert size={11} />
            {view.safetyNote}
          </p>
        </footer>
      </div>
    </div>
  );
}
