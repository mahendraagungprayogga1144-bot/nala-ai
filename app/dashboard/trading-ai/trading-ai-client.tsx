"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Copy,
  Link2,
  OctagonAlert,
  Power,
  Radar,
  RefreshCw,
  Timer,
  Upload,
  MessageSquareText,
} from "lucide-react";
import {
  TRADING_AI_VERSION,
  DEFAULT_TRADING_AI_CONFIG,
  EXECUTION_MIN_CONFIDENCE,
  decideTradingAction,
  journal,
  parseCandlesFile,
  backtest,
  generateBridgeApiKey,
  loadCandles,
  BRIDGE_PROBE_TIMEOUT_MS,
  estimateBrokerNowSec,
  formatGmtOffsetLabel,
  formatMt5DateTime,
  formatMt5Time,
  emptyQuantStats,
  HARD_RULES,
  signalAgeMs,
  type BacktestResult,
  type BridgeConnectionState,
  type BridgeHealthResult,
  type BridgeKeyRow,
  type Candle,
  type CandleFeedStatus,
  type LiveActivity,
  EXECUTION_MODE,
  type TradeDecision,
  type TradingDecisionResult,
} from "@/lib/trading-ai";
import {
  buildPipeline,
  buildWhySignal,
  countFillsSince,
  durationLabel,
  entryQuality,
  estimateGoldFloatingUsd,
  goldPoints,
  inferOpenPosition,
  journalReason,
  marketRegime,
} from "@/lib/trading-ai/quant-desk";
import { createClient } from "@/lib/supabase/client";
import TradingDesk, { type DeskView, type JournalViewRow } from "./components/trading-desk";

const HEALTH_POLL_MS = 15_000;
const CHART_BARS = 80;

const STATE_STYLE: Record<BridgeConnectionState, { chip: string; label: string }> = {
  CONNECTED: { chip: "border-[#00F0A8]/45 bg-[#00F0A8]/15 text-[#00F0A8]", label: "CONNECTED" },
  CONNECTING: { chip: "border-[#FFB14A]/45 bg-[#FFB14A]/15 text-[#FFB14A]", label: "CONNECTING" },
  DISCONNECTED: { chip: "border-white/20 bg-white/5 text-[#9BC5D4]", label: "DISCONNECTED" },
  ERROR: { chip: "border-[#FF3D7F]/45 bg-[#FF3D7F]/12 text-[#FF3D7F]", label: "ERROR" },
};

function fmtAge(sec: number | null) {
  if (sec == null) return "belum pernah";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function candle(i: number, o: number, h: number, l: number, c: number): Candle {
  return { time: 1_700_000_000 + i * 60, open: o, high: h, low: l, close: c };
}

function demoBullishM5(): Candle[] {
  const out: Candle[] = [];
  const base = 2300;
  for (let i = 0; i < 60; i++) {
    const wave = Math.sin(i / 4) * 1.2;
    const drift = i * 0.15;
    const mid = base + drift + wave;
    const bull = i % 5 !== 4;
    const o = mid;
    const close = mid + (bull ? 0.6 : -0.35);
    out.push(candle(i, o, Math.max(o, close) + 0.4, Math.min(o, close) - 0.4, close));
  }
  return out;
}

function demoBullishM1(): Candle[] {
  const out: Candle[] = [];
  let px = 2315;
  for (let i = 0; i < 28; i++) {
    const o = px;
    const close = px - 0.45;
    out.push(candle(i, o, o + 0.08, close - 0.06, close));
    px = close;
  }
  const o = px;
  const close = px + 0.08;
  out.push(candle(out.length, o, close + 0.03, o - 0.18, close));
  return out;
}

function decisionColor(d: TradeDecision) {
  if (d === "BUY") return "#00F0A8";
  if (d === "SELL") return "#FF3D7F";
  if (d === "CLOSE") return "#FFB020";
  return "#5CE1FF";
}

type ControlState = {
  autotradeEnabled: boolean;
  liveEnable: boolean;
  emergencyStop: boolean;
  closeAllOnStop: boolean;
  cooldownSeconds: number;
  cooldownRemaining: number;
  lastEntryAt: number | null;
  lot: number;
};

type ControlAction =
  | "autotrade_on"
  | "autotrade_off"
  | "live_enable_on"
  | "live_enable_off"
  | "emergency_stop"
  | "resume"
  | "settings";

const COOLDOWN_CHOICES = [
  ["5 menit", 300],
  ["15 menit", 900],
  ["30 menit", 1800],
  ["60 menit", 3600],
] as const;

const LOT_CHOICES = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0] as const;

function nowMs(): number {
  return Date.now();
}

function fmtCooldown(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function fmtTs(sec: number | null) {
  return formatMt5Time(sec);
}

function orderStatusChip(status: string) {
  const s = status.toUpperCase();
  if (s === "FILLED" || s === "CLOSED") return "border-[#00F0A8]/40 text-[#00F0A8]";
  if (s === "FAILED" || s === "CLOSE_FAILED") return "border-[#FF3D7F]/40 text-[#FF3D7F]";
  return "border-white/20 text-[#9BC5D4]";
}

function channelAge(health: BridgeHealthResult, id: string): number | null {
  return health.channels.find((c) => c.id === id)?.ageSec ?? null;
}

function channelState(health: BridgeHealthResult, id: string): string {
  return health.channels.find((c) => c.id === id)?.state ?? "N/A";
}

export default function TradingAiClient({
  userId,
  userLabel,
  initialFeed,
  initialKeys,
  initialControl,
  initialControlReady,
  initialHealth,
  initialActivity,
  ingestUrl,
  signalUrl,
  healthUrl,
  schemaReady,
  schemaError,
}: {
  userId: string;
  userLabel: string;
  initialFeed: CandleFeedStatus;
  initialKeys: BridgeKeyRow[];
  initialControl: ControlState;
  initialControlReady: boolean;
  initialHealth: BridgeHealthResult;
  initialActivity: LiveActivity;
  ingestUrl: string;
  signalUrl: string;
  healthUrl: string;
  schemaReady: boolean;
  schemaError: string | null;
}) {
  const supabase = createClient();
  const [result, setResult] = useState<TradingDecisionResult | null>(null);
  const [running, setRunning] = useState(false);
  const [m5Candles, setM5Candles] = useState<Candle[] | null>(null);
  const [m1Candles, setM1Candles] = useState<Candle[] | null>(null);
  const [m5Label, setM5Label] = useState("Belum upload M5");
  const [m1Label, setM1Label] = useState("Belum upload M1");
  const [btRunning, setBtRunning] = useState(false);
  const [btResult, setBtResult] = useState<BacktestResult | null>(null);
  const [btMsg, setBtMsg] = useState<string | null>(null);
  const [keys, setKeys] = useState(initialKeys);
  const [feed, setFeed] = useState(initialFeed);
  const [liveM5, setLiveM5] = useState<Candle[]>([]);
  const [liveM1, setLiveM1] = useState<Candle[]>([]);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyFlash, setKeyFlash] = useState<string | null>(null);
  const [bridgeMsg, setBridgeMsg] = useState<string | null>(schemaError);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [explainBusy, setExplainBusy] = useState(false);
  const [explainErr, setExplainErr] = useState<string | null>(null);
  const [control, setControl] = useState<ControlState>(initialControl);
  const [controlBusy, setControlBusy] = useState(false);
  const [controlMsg, setControlMsg] = useState<string | null>(null);
  const [controlReady, setControlReady] = useState(initialControlReady);
  const [health, setHealth] = useState<BridgeHealthResult>(initialHealth);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthErr, setHealthErr] = useState<string | null>(null);
  const [healthLatencyMs, setHealthLatencyMs] = useState<number | null>(null);
  const [activity, setActivity] = useState<LiveActivity>(initialActivity);
  const [clockTick, setClockTick] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setClockTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const brokerNowSec = estimateBrokerNowSec(
    health.account.brokerTimeSec,
    health.account.brokerCapturedAtMs,
    clockTick,
  );
  const gmtLabel = formatGmtOffsetLabel(health.account.gmtOffsetSec);

  const refreshHealth = async () => {
    setHealthBusy(true);
    setHealthErr(null);
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), BRIDGE_PROBE_TIMEOUT_MS);
    try {
      const res = await fetch("/api/trading-ai/health", {
        cache: "no-store",
        signal: ctrl.signal,
      });
      const json = await res.json();
      setHealthLatencyMs(Date.now() - started);
      if (!res.ok) {
        setHealthErr(json?.error || `HTTP ${res.status}`);
        return;
      }
      setHealth(json as BridgeHealthResult);
    } catch (e) {
      setHealthLatencyMs(Date.now() - started);
      if (e instanceof DOMException && e.name === "AbortError") {
        setHealthErr(`Health check timeout setelah ${BRIDGE_PROBE_TIMEOUT_MS}ms.`);
      } else {
        setHealthErr(e instanceof Error ? e.message : "Gagal menghubungi /api/trading-ai/health.");
      }
    } finally {
      clearTimeout(timer);
      setHealthBusy(false);
    }
  };

  const refreshActivity = async () => {
    try {
      const res = await fetch("/api/trading-ai/activity", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) return;
      setActivity({
        signal: json.signal,
        orders: json.orders ?? [],
        openHint: json.openHint ?? "",
        stats: json.stats ?? emptyQuantStats(),
      });
    } catch {
      // panel live gagal diam-diam; health tetap jadi sumber koneksi
    }
  };

  const refreshFeed = async () => {
    const [m5, m1] = await Promise.all([
      loadCandles(supabase, { userId, timeframe: "M5", limit: CHART_BARS }),
      loadCandles(supabase, { userId, timeframe: "M1", limit: CHART_BARS }),
    ]);
    setLiveM5(m5);
    setLiveM1(m1);
    setFeed({
      symbol: "XAUUSD",
      m5Count: m5.length,
      m1Count: m1.length,
      m5LastTime: m5.length ? m5[m5.length - 1].time : null,
      m1LastTime: m1.length ? m1[m1.length - 1].time : null,
    });
    return { m5, m1 };
  };

  const pulseLiveBrain = async () => {
    try {
      const { m5, m1 } = await refreshFeed();
      if (
        m5.length < DEFAULT_TRADING_AI_CONFIG.brain.minM5Candles ||
        m1.length < DEFAULT_TRADING_AI_CONFIG.brain.minM1Candles
      ) {
        return;
      }
      const last = m1[m1.length - 1].close;
      const spreadPts = activity.signal.spread ?? 20;
      const out = decideTradingAction({
        symbol: "XAUUSD",
        m5Candles: m5,
        m1Candles: m1,
        market: {
          symbol: "XAUUSD",
          bid: last,
          ask: last + spreadPts / 100,
          spread: spreadPts,
          at: nowMs(),
        },
        openPositions: [],
      });
      setResult(out);
    } catch {
      // indikator pakai snapshot EA kalau feed gagal
    }
  };

  useEffect(() => {
    const t = setInterval(() => {
      void refreshHealth();
      void refreshActivity();
      void pulseLiveBrain();
    }, HEALTH_POLL_MS);
    const kick = window.setTimeout(() => {
      void pulseLiveBrain();
    }, 0);
    return () => {
      clearInterval(t);
      window.clearTimeout(kick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (control.cooldownRemaining <= 0) return;
    const t = setInterval(() => {
      setControl((c) => ({
        ...c,
        cooldownRemaining: Math.max(0, c.cooldownRemaining - 1),
      }));
    }, 1000);
    return () => clearInterval(t);
  }, [control.cooldownRemaining]);

  const sendControl = async (
    action: ControlAction,
    extra: { closeAllOnStop?: boolean; cooldownSeconds?: number; lot?: number } = {},
  ) => {
    setControlBusy(true);
    setControlMsg(null);
    try {
      const res = await fetch("/api/trading-ai/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) {
        setControlMsg(json?.error || "Gagal mengubah kontrol eksekusi.");
        return;
      }
      if (json?.control) setControl(json.control as ControlState);
      setControlReady(true);
    } catch (e) {
      setControlMsg(e instanceof Error ? e.message : "Gagal menghubungi server.");
    } finally {
      setControlBusy(false);
    }
  };

  const createKey = async () => {
    if (!schemaReady) {
      setBridgeMsg("Jalankan SQL migrasi Trading AI di Supabase dulu.");
      return;
    }
    setKeyBusy(true);
    setBridgeMsg(null);
    const api_key = generateBridgeApiKey();
    const { data, error } = await supabase
      .from("trading_ai_bridge_keys")
      .insert({ user_id: userId, api_key, label: "MT5 EA" })
      .select("id, api_key, label, last_seen_at, created_at, revoked_at")
      .single();
    setKeyBusy(false);
    if (error) {
      setBridgeMsg(error.message);
      return;
    }
    setKeys((k) => [data as BridgeKeyRow, ...k]);
    setKeyFlash(api_key);
  };

  const revokeKey = async (id: string) => {
    if (!confirm("Cabut API key ini? EA MT5 akan berhenti tersambung.")) return;
    const { error } = await supabase
      .from("trading_ai_bridge_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setBridgeMsg(error.message);
      return;
    }
    setKeys((k) => k.filter((x) => x.id !== id));
  };

  const runFromMt5 = async () => {
    setRunning(true);
    setBridgeMsg(null);
    try {
      const { m5, m1 } = await refreshFeed();
      if (
        m5.length < DEFAULT_TRADING_AI_CONFIG.brain.minM5Candles ||
        m1.length < DEFAULT_TRADING_AI_CONFIG.brain.minM1Candles
      ) {
        setBridgeMsg(
          `Data MT5 belum cukup. M5=${m5.length} (min ${DEFAULT_TRADING_AI_CONFIG.brain.minM5Candles}), M1=${m1.length} (min ${DEFAULT_TRADING_AI_CONFIG.brain.minM1Candles}). Pastikan EA sudah push.`,
        );
        setRunning(false);
        return;
      }
      const last = m1[m1.length - 1].close;
      const spreadPts = activity.signal.spread ?? 20;
      const out = decideTradingAction({
        symbol: "XAUUSD",
        m5Candles: m5,
        m1Candles: m1,
        market: {
          symbol: "XAUUSD",
          bid: last,
          ask: last + spreadPts / 100,
          spread: spreadPts,
          at: nowMs(),
        },
        openPositions: [],
      });
      setResult(out);
      setExplainText(null);
      setExplainErr(null);
      journal.appendJournal(journal.buildJournalEntry(out, { notes: "MT5 feed" }));
    } catch (e) {
      setBridgeMsg(e instanceof Error ? e.message : "Gagal baca feed MT5");
    } finally {
      setRunning(false);
    }
  };

  const runExplain = async () => {
    if (!result) {
      setExplainErr("Menunggu keputusan Trading Brain dari feed live.");
      return;
    }
    setExplainBusy(true);
    setExplainErr(null);
    try {
      const res = await fetch("/api/trading-ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: result }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExplainErr(data.error || "Gagal minta penjelasan AI");
        setExplainText(null);
        return;
      }
      setExplainText(data.explanation || "");
    } catch (e) {
      setExplainErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setExplainBusy(false);
    }
  };

  const onCsv = async (kind: "m5" | "m1", file: File | null) => {
    if (!file) return;
    setBtMsg(null);
    const parsed = await parseCandlesFile(file);
    if (!parsed.ok) {
      setBtMsg(parsed.error);
      return;
    }
    if (kind === "m5") {
      setM5Candles(parsed.candles);
      setM5Label(`${file.name} · ${parsed.candles.length} bar`);
    } else {
      setM1Candles(parsed.candles);
      setM1Label(`${file.name} · ${parsed.candles.length} bar`);
    }
    if (parsed.warnings[0]) setBtMsg(parsed.warnings.join(" · "));
  };

  const runCsvBacktest = () => {
    if (!m5Candles?.length || !m1Candles?.length) {
      setBtMsg("Upload CSV M5 dan M1 dulu (export dari MT5).");
      return;
    }
    setBtRunning(true);
    setBtMsg(null);
    setTimeout(() => {
      try {
        const out = backtest.runBacktest({
          symbol: "XAUUSD",
          m5Candles,
          m1Candles,
          config: DEFAULT_TRADING_AI_CONFIG,
          maxSteps: 4000,
        });
        setBtResult(out);
        setBtMsg(out.notes.join(" "));
      } catch (e) {
        setBtMsg(e instanceof Error ? e.message : "Backtest gagal.");
      } finally {
        setBtRunning(false);
      }
    }, 30);
  };

  const runDemo = () => {
    setRunning(true);
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
              pullbackMaxDepth: 0.55,
              pullbackDepthBasis: "impulse",
              levelTouchAtrMult: 1.2,
            },
          },
        },
      );
      setResult(out);
      setExplainText(null);
      setExplainErr(null);
      journal.appendJournal(journal.buildJournalEntry(out, { notes: "Demo pulse" }));
      setRunning(false);
    });
  };

  const d = (activity.signal.decision || result?.decision || "WAIT") as TradeDecision;
  const liveConf = activity.signal.confidence ?? result?.confidence ?? 0;
  const stats = activity.stats ?? emptyQuantStats();
  const maxSpread = DEFAULT_TRADING_AI_CONFIG.risk.maxSpreadPoints;
  const spreadPts = activity.signal.spread;
  const feedOk =
    feed.m5Count >= DEFAULT_TRADING_AI_CONFIG.brain.minM5Candles &&
    feed.m1Count >= DEFAULT_TRADING_AI_CONFIG.brain.minM1Candles;
  const openPos = inferOpenPosition(activity.orders);
  const lastClose = liveM1.length ? liveM1[liveM1.length - 1].close : null;
  const floating = openPos
    ? estimateGoldFloatingUsd(openPos.side, openPos.entryPrice, lastClose, openPos.lot)
    : null;
  const floatingPts =
    openPos && lastClose != null ? goldPoints(openPos.entryPrice, lastClose) : null;
  const signedPts =
    floatingPts == null || !openPos
      ? null
      : openPos.side === "BUY"
        ? floatingPts
        : floatingPts == null
          ? null
          : -floatingPts;
  const riskScore =
    spreadPts == null ? 0 : Math.min(10, Math.round((spreadPts / Math.max(maxSpread, 1)) * 100) / 10);
  const spreadOk = spreadPts == null ? false : spreadPts <= maxSpread;
  const pipeline = buildPipeline({
    feedOk,
    feedAgeSec: channelAge(health, "feed"),
    decision: activity.signal.decision ?? result?.decision ?? null,
    confidence: liveConf,
    minConfidence: EXECUTION_MIN_CONFIDENCE,
    serverExecutable: activity.signal.serverExecutable,
    lastStatus: stats.lastStatus,
    hasOpenPosition: Boolean(openPos),
    riskBlocked: result ? !result.risk.allowed : false,
  });
  const why = buildWhySignal({
    decision: String(d),
    result,
    spreadOk,
    hasOpenPosition: Boolean(openPos),
    openHint: activity.openHint,
  });
  const m5Bias = activity.signal.m5Bias || result?.trend.direction || "N/A";
  const m5Strength =
    result?.trend.strength != null ? `${Math.round(result.trend.strength * 100)}%` : "N/A";
  const m1Momentum = result?.momentum.direction || activity.signal.m1Direction || "N/A";
  const quality = entryQuality(liveConf, EXECUTION_MIN_CONFIDENCE);
  const bid =
    lastClose != null && spreadPts != null ? (lastClose).toFixed(3) : lastClose != null ? lastClose.toFixed(3) : "N/A";
  const ask =
    lastClose != null && spreadPts != null
      ? (lastClose + spreadPts / 100).toFixed(3)
      : "N/A";
  const accountMode = (activity.signal.accountMode || health.account.mode || "N/A").toUpperCase();
  const login =
    activity.signal.accountLogin != null
      ? String(activity.signal.accountLogin)
      : health.account.login != null
        ? String(health.account.login)
        : "N/A";
  const sigAge = signalAgeMs(activity.signal.at ? Date.parse(activity.signal.at) : null, clockTick);
  const rr =
    result?.entry.suggestedStopLoss != null &&
    result?.entry.suggestedTakeProfit != null &&
    lastClose != null
      ? DEFAULT_TRADING_AI_CONFIG.brain.takeProfitRr.toFixed(1)
      : "N/A";

  const journalRows: JournalViewRow[] = activity.orders.map((o) => ({
    id: o.id,
    time: o.createdAt
      ? new Date(o.createdAt).toLocaleString("id-ID", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      : "N/A",
    symbol: "XAUUSDm",
    type: o.direction || "N/A",
    lot: o.lot != null ? o.lot.toFixed(2) : "N/A",
    entry: o.entryPrice != null ? o.entryPrice.toFixed(3) : "N/A",
    exit: "N/A",
    pips: "N/A",
    pnl: "N/A",
    duration: "N/A",
    reason: journalReason(o.status, o.errorMessage),
    status: o.status,
  }));

  const now = clockTick;
  const day = 86_400_000;
  const view: DeskView = {
      userLabel,
      serverTime: brokerNowSec ? formatMt5DateTime(brokerNowSec) : "N/A",
      gmtLabel,
      connection: health.state,
      accountMode,
      login,
      broker: "N/A",
      server: "N/A",
      decision: String(d).toUpperCase(),
      decisionColor: decisionColor(d),
      confidence: liveConf,
      minConfidence: EXECUTION_MIN_CONFIDENCE,
      openHint: activity.openHint,
      kpis: {
        totalPnl: floating,
        realized: null,
        floating,
        equity: null,
        balance: null,
        winRate: null,
        trades: stats.fills,
        avgWin: null,
        avgLoss: null,
        profitFactor: null,
        maxDd: null,
        risk: spreadPts == null ? null : riskScore,
        riskLabel: spreadPts == null ? "WAITING DATA" : spreadPts < maxSpread * 0.6 ? "SAFE" : "WIDE",
      },
      openPos,
      posCount: `${openPos ? 1 : 0} / ${HARD_RULES.MAX_POSITION}`,
      currentPrice: lastClose,
      floating,
      floatingPts: signedPts,
      duration: openPos ? durationLabel(openPos.openedAt, now) : "N/A",
      spreadPts: spreadPts ?? null,
      m5Bias,
      m5Strength,
      m1State: activity.signal.m1Direction || result?.momentum.direction || "N/A",
      m1Momentum,
      entryQuality: quality,
      exitStatus: openPos ? "HOLD" : stats.lastStatus || "FLAT",
      bid,
      ask,
      regime: marketRegime(result?.trend.direction || activity.signal.m5Bias),
      support:
        result?.supportResistance.nearestSupport != null
          ? result.supportResistance.nearestSupport.toFixed(3)
          : "N/A",
      resistance:
        result?.supportResistance.nearestResistance != null
          ? result.supportResistance.nearestResistance.toFixed(3)
          : "N/A",
      liveM5,
      liveM1,
      feedLive: (channelAge(health, "feed") ?? 999) < 90,
      brain: {
        pullback: result ? (result.pullback.detected ? "CONFIRMED" : "NO") : "N/A",
        rejection: result ? (result.rejection.detected ? "CONFIRMED" : "NO") : "N/A",
        riskGate: result ? (result.risk.allowed ? "PASS" : "BLOCK") : "N/A",
        final:
          d === "WAIT"
            ? "WAIT"
            : `${String(d)} ${control.lot.toFixed(2)}`,
        reason: result?.reasons[0] || activity.openHint,
      },
      why,
      pipeline,
      healthRows: [
        {
          label: "Gercep API",
          state: healthErr ? "ERROR" : "CONNECTED",
          age: healthLatencyMs != null ? `${healthLatencyMs}ms` : "—",
        },
        { label: "Candle feed", state: channelState(health, "feed"), age: fmtAge(channelAge(health, "feed")) },
        {
          label: "Trading Brain",
          state: result ? "ACTIVE" : feedOk ? "WAITING" : "INACTIVE",
          age: "—",
        },
        {
          label: "Executor",
          state: channelState(health, "executor"),
          age: fmtAge(channelAge(health, "executor")),
        },
        { label: "MT5 bridge", state: health.state, age: "—" },
        { label: "Database", state: schemaReady ? "CONNECTED" : "ERROR", age: "—" },
      ],
      diagnostic: {
        SIGNAL: String(d).toUpperCase(),
        CONFIDENCE: String(liveConf),
        "ENTRY QUALITY": quality,
        TARGET: result?.entry.suggestedTakeProfit?.toFixed(3) ?? "N/A",
        "STOP LOSS": result?.entry.suggestedStopLoss?.toFixed(3) ?? "N/A",
        "TAKE PROFIT": result?.entry.suggestedTakeProfit?.toFixed(3) ?? "N/A",
        "RISK REWARD": rr === "N/A" ? "N/A" : `1 : ${rr}`,
        LOT: control.lot.toFixed(2),
        SPREAD: spreadPts == null ? "N/A" : String(spreadPts),
        "SIGNAL AGE": sigAge == null ? "N/A" : `${Math.round(sigAge / 1000)}s`,
        COOLDOWN: control.cooldownRemaining > 0 ? fmtCooldown(control.cooldownRemaining) : "READY",
        "POSITION LIMIT": `${openPos ? 1 : 0} / ${HARD_RULES.MAX_POSITION}`,
      },
      tree: [
        { id: "data", label: "MARKET DATA", on: health.state === "CONNECTED", sub: health.state },
        { id: "candle", label: "CANDLE", on: feedOk, sub: `M5 ${feed.m5Count} · M1 ${feed.m1Count}` },
        { id: "scan", label: "SCAN", on: feedOk, sub: feedOk ? "LIVE" : "WAIT" },
        { id: "m5", label: "M5 REGIME", on: Boolean(result?.trend.direction || activity.signal.m5Bias), sub: m5Bias },
        {
          id: "m1",
          label: "M1 SETUP",
          on: Boolean(result?.pullback.detected || result?.rejection.detected),
          sub: activity.signal.m1Direction || "—",
        },
        { id: "pb", label: "PULLBACK", on: Boolean(result?.pullback.detected), sub: result?.pullback.detected ? "YES" : "NO" },
        { id: "rj", label: "REJECTION", on: Boolean(result?.rejection.detected), sub: result?.rejection.side || "NO" },
        {
          id: "mom",
          label: "MOMENTUM",
          on: Boolean(result?.momentum.alignedWithTrend),
          sub: result?.momentum.direction || "—",
        },
        { id: "risk", label: "RISK GATE", on: Boolean(result?.risk.allowed), sub: result ? (result.risk.allowed ? "PASS" : "BLOCK") : "—" },
        {
          id: "out",
          label: String(d).toUpperCase(),
          on: d !== "WAIT",
          sub: activity.signal.serverExecutable ? "READY" : "HOLD",
        },
      ],
      features: result?.validation.breakdown.features ?? [],
      analytics: {
        d7: countFillsSince(activity.orders, now - 7 * day),
        d30: countFillsSince(activity.orders, now - 30 * day),
        d90: countFillsSince(activity.orders, now - 90 * day),
      },
      journal: journalRows,
      result,
      activity,
      autotrade: control.autotradeEnabled,
      liveEnable: control.liveEnable,
      killSwitch: control.emergencyStop,
      cooldown: control.cooldownRemaining > 0 ? fmtCooldown(control.cooldownRemaining) : "siap",
      lot: control.lot.toFixed(2),
      safetyNote:
        accountMode === "REAL" && !control.liveEnable
          ? "REAL ACCOUNT · LIVE EXECUTION DISABLED"
          : accountMode === "DEMO"
            ? control.autotradeEnabled
              ? "DEMO ACCOUNT · AUTO EXECUTION ACTIVE"
              : "DEMO ACCOUNT · AUTO OFF"
            : `${accountMode} · ${control.autotradeEnabled ? "AUTO ON" : "AUTO OFF"}`,
      aiActive: Boolean(result) || health.state === "CONNECTED",
    };

  const box = "border border-white/[0.09] bg-[#070B12]/90 p-3";

  return (
    <TradingDesk
      view={view}
      explain={
        <div className="mt-3">
          <button
            type="button"
            onClick={runExplain}
            disabled={!result || explainBusy}
            className="inline-flex items-center gap-1.5 border border-[#5CE1FF]/40 bg-[#5CE1FF]/10 px-3 py-1.5 text-[11px] font-semibold text-[#5CE1FF] disabled:opacity-45"
          >
            {explainBusy ? <Radar size={12} className="animate-spin" /> : <MessageSquareText size={12} />}
            {explainBusy ? "Claude menjelaskan…" : "Jelaskan (Claude)"}
          </button>
          {explainErr ? <p className="mt-2 text-[11px] text-[#FFB4D4]">{explainErr}</p> : null}
          {explainText ? (
            <div className="mt-2 whitespace-pre-wrap border border-[#5CE1FF]/20 bg-black/40 px-3 py-2 text-[11px] leading-relaxed text-[#C8E7F2]">
              {explainText}
            </div>
          ) : null}
        </div>
      }
      execution={
        <div className={box}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#FFB14A]">
              <Power size={13} /> execution · {EXECUTION_MODE}
            </p>
            <button
              type="button"
              onClick={() => {
                void refreshActivity();
                void pulseLiveBrain();
              }}
              className="inline-flex items-center gap-1 border border-white/15 px-2 py-1 text-[10px] text-[#9BC5D4]"
            >
              <RefreshCw size={11} /> refresh
            </button>
          </div>
          {!controlReady && (
            <div className="mb-3 border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100">
              Jalankan SQL migrasi live_enable di Supabase kalau tombol LIVE ENABLE error.
            </div>
          )}
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={controlBusy}
              onClick={() => sendControl(control.autotradeEnabled ? "autotrade_off" : "autotrade_on")}
              className={`border px-4 py-2 text-xs font-bold disabled:opacity-50 ${
                control.autotradeEnabled
                  ? "border-[#00F0A8]/45 bg-[#00F0A8]/15 text-[#00F0A8]"
                  : "border-white/15 text-[#9BC5D4]"
              }`}
            >
              LIVE AUTOTRADE {control.autotradeEnabled ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              disabled={controlBusy}
              onClick={() => {
                if (!control.liveEnable) {
                  if (!confirm("LIVE ENABLE untuk akun REAL: order sungguhan bisa terbuka. Lanjutkan?")) {
                    return;
                  }
                }
                sendControl(control.liveEnable ? "live_enable_off" : "live_enable_on");
              }}
              className={`border px-4 py-2 text-xs font-bold disabled:opacity-50 ${
                control.liveEnable
                  ? "border-[#FFB14A]/50 bg-[#FFB14A]/15 text-[#FFB14A]"
                  : "border-white/15 text-[#9BC5D4]"
              }`}
            >
              LIVE ENABLE {control.liveEnable ? "ENABLED" : "DISABLED"}
            </button>
            <button
              type="button"
              disabled={controlBusy || control.emergencyStop}
              onClick={() => {
                if (!confirm("EMERGENCY STOP: hentikan semua entry baru?")) return;
                sendControl("emergency_stop");
              }}
              className="inline-flex items-center gap-1.5 border border-[#FF3D7F]/45 bg-[#FF3D7F]/12 px-4 py-2 text-xs font-bold text-[#FF3D7F] disabled:opacity-50"
            >
              <OctagonAlert size={13} /> EMERGENCY STOP
            </button>
            {control.emergencyStop && (
              <button
                type="button"
                disabled={controlBusy}
                onClick={() => sendControl("resume")}
                className="border border-white/15 px-4 py-2 text-xs text-[#9BC5D4] disabled:opacity-50"
              >
                Resume (autotrade tetap OFF)
              </button>
            )}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-[#9BC5D4]">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={control.closeAllOnStop}
                disabled={controlBusy}
                onChange={(e) => sendControl("settings", { closeAllOnStop: e.target.checked })}
              />
              Tutup posisi saat emergency stop
            </label>
            <label className="inline-flex items-center gap-2">
              <Timer size={12} /> Cooldown
              <select
                value={control.cooldownSeconds}
                disabled={controlBusy}
                onChange={(e) => sendControl("settings", { cooldownSeconds: Number(e.target.value) })}
                className="border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-[#E8F7FF]"
              >
                {COOLDOWN_CHOICES.map(([label, val]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-2">
              Lot
              <select
                value={control.lot ?? DEFAULT_TRADING_AI_CONFIG.risk.defaultLot}
                disabled={controlBusy}
                onChange={(e) => sendControl("settings", { lot: Number(e.target.value) })}
                className="border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-[#E8F7FF]"
              >
                {LOT_CHOICES.map((v) => (
                  <option key={v} value={v}>
                    {v.toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {controlMsg ? (
            <div className="mb-2 border border-[#FF3D7F]/30 bg-[#FF3D7F]/10 px-3 py-2 text-[11px] text-[#FFC2D8]">
              {controlMsg}
            </div>
          ) : null}
          <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[#6A8A99]">riwayat order EA</p>
          {activity.orders.length === 0 ? (
            <p className="text-[11px] text-[#6A8A99]">Belum ada order tercatat.</p>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {activity.orders.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-white/5 bg-black/20 px-3 py-2 text-[11px]"
                >
                  <div>
                    <span className={`mr-2 inline-flex border px-2 py-0.5 text-[10px] font-semibold ${orderStatusChip(o.status)}`}>
                      {o.status}
                    </span>
                    <span className="font-semibold text-[#E8F7FF]">
                      {o.direction || "—"} {o.lot != null ? o.lot : ""}
                    </span>
                    <span className="ml-2 text-[#6A8A99]">
                      @ {o.entryPrice != null ? o.entryPrice : "—"}
                      {o.ticket != null ? ` · tiket ${o.ticket}` : ""}
                    </span>
                    {o.errorMessage ? <p className="mt-0.5 text-[10px] text-[#FFC2D8]">{o.errorMessage}</p> : null}
                  </div>
                  <p className="text-[10px] text-[#6A8A99]">
                    {o.createdAt
                      ? new Date(o.createdAt).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      }
      backtest={
        <div className={box}>
          <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[#FF3D7F]">CSV backtest · otak tidak diubah</p>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <label className="cursor-pointer border border-dashed border-[#5CE1FF]/35 bg-black/25 px-4 py-4">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-[#5CE1FF]">
                <Upload size={14} /> CSV M5
              </div>
              <p className="text-[10px] text-[#7FA4B3]">{m5Label}</p>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onCsv("m5", e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="cursor-pointer border border-dashed border-[#FF3D9A]/35 bg-black/25 px-4 py-4">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-[#FF3D9A]">
                <Upload size={14} /> CSV M1
              </div>
              <p className="text-[10px] text-[#7FA4B3]">{m1Label}</p>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onCsv("m1", e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={runCsvBacktest}
            disabled={btRunning}
            className="mb-3 flex w-full items-center justify-center gap-2 bg-[#5CE1FF] py-3 text-sm font-bold text-black disabled:opacity-55"
          >
            {btRunning ? <Radar size={16} className="animate-spin" /> : <Activity size={16} />}
            {btRunning ? "Rewinding…" : "Jalankan backtest CSV"}
          </button>
          {btMsg ? <p className="mb-3 text-[11px] text-[#9BC5D4]">{btMsg}</p> : null}
          {btResult ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Trades", String(btResult.trades.length)],
                ["Wins", String(btResult.wins)],
                ["Losses", String(btResult.losses)],
                ["PnL≈", btResult.totalPnl.toFixed(2)],
              ].map(([k, v]) => (
                <div key={k} className="border border-white/5 bg-black/25 px-3 py-2">
                  <p className="text-[9px] uppercase text-[#6A8A99]">{k}</p>
                  <p className="font-mono text-sm text-[#E8F7FF]">{v}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      }
      settings={
        <div className={box}>
          <p className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#00F0A8]">
            Pengaturan bridge · v{TRADING_AI_VERSION}
          </p>
          <div className="mb-3 grid gap-2 sm:grid-cols-4">
            {[
              ["M5 bars", String(feed.m5Count)],
              ["M1 bars", String(feed.m1Count)],
              ["M5 last", fmtTs(feed.m5LastTime)],
              ["M1 last", fmtTs(feed.m1LastTime)],
            ].map(([k, v]) => (
              <div key={k} className="border border-white/5 bg-black/25 px-3 py-2">
                <p className="text-[9px] uppercase text-[#6A8A99]">{k}</p>
                <p className="font-mono text-sm text-[#E8F7FF]">{v}</p>
              </div>
            ))}
          </div>
          <div className="mb-3 space-y-2 text-[11px] text-[#9BC5D4]">
            <div className="border border-white/5 bg-black/30 px-3 py-2">
              <div className="mb-1 flex items-center gap-2 text-[#5CE1FF]">
                <Link2 size={12} /> Ingest
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all text-[#E8F7FF]">{ingestUrl}</code>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 border border-[#5CE1FF]/30 px-2 py-1 text-[10px] text-[#5CE1FF]"
                  onClick={() => navigator.clipboard.writeText(ingestUrl)}
                >
                  <Copy size={11} /> copy
                </button>
              </div>
            </div>
            <div className="border border-white/5 bg-black/30 px-3 py-2">
              <div className="mb-1 flex items-center gap-2 text-[#FFB14A]">
                <Link2 size={12} /> Signal
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all text-[#E8F7FF]">{signalUrl}</code>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 border border-[#FFB14A]/30 px-2 py-1 text-[10px] text-[#FFB14A]"
                  onClick={() => navigator.clipboard.writeText(signalUrl)}
                >
                  <Copy size={11} /> copy
                </button>
              </div>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={keyBusy || !schemaReady}
              onClick={createKey}
              className="border border-[#00F0A8]/40 bg-[#00F0A8]/10 px-3 py-2 text-xs font-semibold text-[#00F0A8] disabled:opacity-50"
            >
              {keyBusy ? "..." : "+ Buat API key EA"}
            </button>
            <button
              type="button"
              onClick={() => void refreshFeed()}
              className="border border-white/15 px-3 py-2 text-xs text-[#9BC5D4]"
            >
              Refresh feed
            </button>
            <button
              type="button"
              disabled={running}
              onClick={runFromMt5}
              className="bg-[#5CE1FF] px-3 py-2 text-xs font-bold text-black disabled:opacity-55"
            >
              Jalankan otak dari data MT5
            </button>
            <button
              type="button"
              disabled={running}
              onClick={runDemo}
              className="border border-white/15 px-3 py-2 text-xs text-[#9BC5D4]"
            >
              Demo pulse (sandbox)
            </button>
            <button
              type="button"
              disabled={healthBusy}
              onClick={() => void refreshHealth()}
              className="inline-flex items-center gap-1 border border-white/15 px-3 py-2 text-xs text-[#9BC5D4]"
            >
              <RefreshCw size={11} className={healthBusy ? "animate-spin" : ""} /> cek bridge
            </button>
          </div>
          {keyFlash ? (
            <div className="mb-3 border border-[#00F0A8]/35 bg-[#00F0A8]/10 px-3 py-2 text-[11px] text-[#B8FFE8]">
              Key baru: <code className="break-all text-white">{keyFlash}</code>
            </div>
          ) : null}
          {keys.length > 0 ? (
            <div className="mb-3 divide-y divide-white/5 border border-white/5">
              {keys.map((k) => (
                <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px]">
                  <div>
                    <p className="font-semibold text-[#E8F7FF]">{k.label}</p>
                    <p className="text-[#6A8A99]">
                      {k.api_key.slice(0, 12)}… · last seen{" "}
                      {k.last_seen_at ? new Date(k.last_seen_at).toLocaleString("id-ID") : "belum"}
                    </p>
                  </div>
                  <button type="button" onClick={() => revokeKey(k.id)} className="text-[#FF3D7F] underline">
                    cabut
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <p className="text-[10px] text-[#6A8A99]">
            {health.summary} · {healthUrl}
            {bridgeMsg ? ` · ${bridgeMsg}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {health.channels.map((ch) => (
              <span key={ch.id} className={`border px-2 py-0.5 text-[10px] ${STATE_STYLE[ch.state].chip}`}>
                {ch.expert} {ch.state}
              </span>
            ))}
          </div>
        </div>
      }
    />
  );
}
