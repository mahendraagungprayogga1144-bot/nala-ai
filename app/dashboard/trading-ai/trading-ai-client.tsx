"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Copy,
  Crosshair,
  Link2,
  Lock,
  OctagonAlert,
  PlugZap,
  Power,
  Radar,
  Radio,
  RefreshCw,
  Shield,
  Sparkles,
  Timer,
  Upload,
  MessageSquareText,
  Zap,
} from "lucide-react";
import {
  TRADING_AI_VERSION,
  DEFAULT_TRADING_AI_CONFIG,
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
import { createClient } from "@/lib/supabase/client";

const HEALTH_POLL_MS = 15_000;

const STATE_STYLE: Record<
  BridgeConnectionState,
  { chip: string; label: string }
> = {
  CONNECTED: { chip: "border-[#00F0A8]/45 bg-[#00F0A8]/15 text-[#00F0A8]", label: "CONNECTED" },
  CONNECTING: { chip: "border-[#FFB14A]/45 bg-[#FFB14A]/15 text-[#FFB14A]", label: "CONNECTING" },
  DISCONNECTED: { chip: "border-white/20 bg-white/5 text-[#9BC5D4]", label: "DISCONNECTED" },
  ERROR: { chip: "border-[#FF3D7F]/45 bg-[#FF3D7F]/12 text-[#FF3D7F]", label: "ERROR" },
};

function fmtAge(sec: number | null) {
  if (sec == null) return "belum pernah";
  if (sec < 60) return `${sec}s lalu`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s lalu`;
}

function candle(i: number, o: number, h: number, l: number, c: number): Candle {
  return { time: 1_700_000_000 + i * 60, open: o, high: h, low: l, close: c };
}

/** Demo M5 bullish structure (enough bars for analyzer). */
function demoBullishM5(): Candle[] {
  const out: Candle[] = [];
  const base = 2300;
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
  "M5 sideways → scalp di kotak S/R (M1)",
  "Pullback → rejection → momentum",
  "Max 1 posisi · no avg / grid / hedge",
  "Auto-execute LIVE · demo & real (uang sungguhan)",
];

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

/** Dibungkus supaya pemanggilan jam tidak dianggap impure di dalam komponen. */
function nowMs(): number {
  return Date.now();
}

function fmtCooldown(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** Jam candle = jam chart MT5 (bukan jam PC). */
function fmtTs(sec: number | null) {
  return formatMt5Time(sec);
}

function fmtLocalNow(ms = Date.now()) {
  return new Date(ms).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function decisionChip(decision: string | null) {
  const d = (decision || "—").toUpperCase();
  if (d === "BUY") return "border-[#00F0A8]/45 bg-[#00F0A8]/15 text-[#00F0A8]";
  if (d === "SELL") return "border-[#FF3D7F]/45 bg-[#FF3D7F]/12 text-[#FF3D7F]";
  if (d === "CLOSE") return "border-[#FFB14A]/45 bg-[#FFB14A]/15 text-[#FFB14A]";
  return "border-white/20 bg-white/5 text-[#9BC5D4]";
}

function orderStatusChip(status: string) {
  const s = status.toUpperCase();
  if (s === "FILLED" || s === "CLOSED") {
    return "border-[#00F0A8]/40 text-[#00F0A8]";
  }
  if (s === "FAILED" || s === "CLOSE_FAILED") {
    return "border-[#FF3D7F]/40 text-[#FF3D7F]";
  }
  return "border-white/20 text-[#9BC5D4]";
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
  const [log, setLog] = useState(journal.listJournal(8));
  const [m5Candles, setM5Candles] = useState<Candle[] | null>(null);
  const [m1Candles, setM1Candles] = useState<Candle[] | null>(null);
  const [m5Label, setM5Label] = useState("Belum upload M5");
  const [m1Label, setM1Label] = useState("Belum upload M1");
  const [btRunning, setBtRunning] = useState(false);
  const [btResult, setBtResult] = useState<BacktestResult | null>(null);
  const [btMsg, setBtMsg] = useState<string | null>(null);
  const [keys, setKeys] = useState(initialKeys);
  const [feed, setFeed] = useState(initialFeed);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyFlash, setKeyFlash] = useState<string | null>(null);
  const [bridgeMsg, setBridgeMsg] = useState<string | null>(schemaError);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [explainBusy, setExplainBusy] = useState(false);
  const [explainErr, setExplainErr] = useState<string | null>(null);
  // Status awal datang dari server component — tidak ada fetch saat mount.
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

  // Jam MT5 di UI mengikuti heartbeat broker; tick tiap detik biar tidak beku.
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
      });
    } catch {
      // panel live gagal diam-diam; health tetap jadi sumber koneksi
    }
  };

  // Poll status bridge + panel sinyal/order.
  useEffect(() => {
    const t = setInterval(() => {
      void refreshHealth();
      void refreshActivity();
    }, HEALTH_POLL_MS);
    return () => clearInterval(t);
  }, []);

  // Cooldown dihitung server; hitung mundur lokal cuma untuk tampilan.
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

  const refreshFeed = async () => {
    const [m5, m1] = await Promise.all([
      loadCandles(supabase, { userId, timeframe: "M5", limit: 500 }),
      loadCandles(supabase, { userId, timeframe: "M1", limit: 500 }),
    ]);
    setFeed({
      symbol: "XAUUSD",
      m5Count: m5.length,
      m1Count: m1.length,
      m5LastTime: m5.length ? m5[m5.length - 1].time : null,
      m1LastTime: m1.length ? m1[m1.length - 1].time : null,
    });
    return { m5, m1 };
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
      if (m5.length < DEFAULT_TRADING_AI_CONFIG.brain.minM5Candles ||
          m1.length < DEFAULT_TRADING_AI_CONFIG.brain.minM1Candles) {
        setBridgeMsg(
          `Data MT5 belum cukup. M5=${m5.length} (min ${DEFAULT_TRADING_AI_CONFIG.brain.minM5Candles}), M1=${m1.length} (min ${DEFAULT_TRADING_AI_CONFIG.brain.minM1Candles}). Pastikan EA sudah push.`,
        );
        setRunning(false);
        return;
      }
      const last = m1[m1.length - 1].close;
      const out = decideTradingAction({
        symbol: "XAUUSD",
        m5Candles: m5,
        m1Candles: m1,
        market: {
          symbol: "XAUUSD",
          bid: last,
          ask: last + 0.2,
          spread: 20,
          at: nowMs(),
        },
        openPositions: [],
      });
      setResult(out);
      setExplainText(null);
      setExplainErr(null);
      journal.appendJournal(journal.buildJournalEntry(out, { notes: "MT5 feed" }));
      setLog(journal.listJournal(8));
    } catch (e) {
      setBridgeMsg(e instanceof Error ? e.message : "Gagal baca feed MT5");
    } finally {
      setRunning(false);
    }
  };

  const runExplain = async () => {
    if (!result) {
      setExplainErr("Jalankan otak dulu (demo / MT5 / CSV) supaya ada keputusan.");
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
      setExplainText(null);
      setExplainErr(null);
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
              Otak XAUUSD gaya manual kamu. EA mengeksekusi order di akun MT5 demo
              atau real saat autotrade dinyalakan. Akun real = uang sungguhan —
              wajib LIVE ENABLE terpisah + lot kecil + emergency stop siap.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest">
            <span className="cp-chip rounded-full px-3 py-1.5 text-[#5CE1FF]">operator {userLabel}</span>
            <span className="cp-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[#00F0A8]">
              <Lock size={11} /> live on
            </span>
            <span className="cp-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[#00F0A8]">
              <Shield size={11} /> max 1 pos
            </span>
          </div>
        </div>

        {/* Execution control */}
        <div className="cp-panel mb-4 rounded-2xl p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#FFB14A]">
              <Power size={13} /> execution mode · {EXECUTION_MODE}
            </p>
            <p className="text-[10px] text-[#6A8A99]">
              order sungguhan ke akun demo atau real
            </p>
          </div>

          {!controlReady && (
            <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100">
              Jalankan SQL migrasi{" "}
              <code className="text-amber-200">20260817_trading_ai_live_enable.sql</code>{" "}
              (+ lot / control sebelumnya) di Supabase kalau tombol LIVE ENABLE error.
            </div>
          )}

          {(activity.signal.accountMode === "real" || control.liveEnable) && (
            <div className="mb-3 rounded-xl border border-[#FF3D7F]/35 bg-[#FF3D7F]/10 px-3 py-2 text-[11px] text-[#FFC2D8]">
              {activity.signal.accountMode === "real"
                ? "Akun REAL terdeteksi dari EA. Entry hanya jalan jika LIVE ENABLE = ON."
                : "LIVE ENABLE aktif — kalau EA konek ke akun real, order sungguhan bisa terbuka."}
            </div>
          )}

          <div className="mb-3 grid gap-2 sm:grid-cols-5">
            {[
              ["Autotrade", control.autotradeEnabled ? "ON" : "OFF"],
              ["Live enable", control.liveEnable ? "ENABLED" : "DISABLED"],
              ["Emergency", control.emergencyStop ? "STOP" : "normal"],
              ["Cooldown", control.cooldownRemaining > 0 ? fmtCooldown(control.cooldownRemaining) : "siap"],
              ["Lot", (control.lot ?? DEFAULT_TRADING_AI_CONFIG.risk.defaultLot).toFixed(2)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/5 bg-black/25 px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wider text-[#6A8A99]">{k}</p>
                <p className="mt-1 text-sm font-semibold text-[#E8F7FF]">{v}</p>
              </div>
            ))}
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={controlBusy}
              onClick={() =>
                sendControl(control.autotradeEnabled ? "autotrade_off" : "autotrade_on")
              }
              className={`rounded-xl border px-4 py-2 text-xs font-bold disabled:opacity-50 ${
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
                  if (
                    !confirm(
                      "LIVE ENABLE untuk akun REAL: order sungguhan bisa terbuka. Lanjutkan?",
                    )
                  ) {
                    return;
                  }
                }
                sendControl(control.liveEnable ? "live_enable_off" : "live_enable_on");
              }}
              className={`rounded-xl border px-4 py-2 text-xs font-bold disabled:opacity-50 ${
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#FF3D7F]/45 bg-[#FF3D7F]/12 px-4 py-2 text-xs font-bold text-[#FF3D7F] disabled:opacity-50"
            >
              <OctagonAlert size={13} /> EMERGENCY STOP
            </button>

            {control.emergencyStop && (
              <button
                type="button"
                disabled={controlBusy}
                onClick={() => sendControl("resume")}
                className="rounded-xl border border-white/15 px-4 py-2 text-xs text-[#9BC5D4] disabled:opacity-50"
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
                onChange={(e) =>
                  sendControl("settings", { closeAllOnStop: e.target.checked })
                }
              />
              Tutup posisi saat emergency stop
            </label>
            <label className="inline-flex items-center gap-2">
              <Timer size={12} /> Cooldown
              <select
                value={control.cooldownSeconds}
                disabled={controlBusy}
                onChange={(e) =>
                  sendControl("settings", { cooldownSeconds: Number(e.target.value) })
                }
                className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-[#E8F7FF]"
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
                className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-[#E8F7FF]"
              >
                {LOT_CHOICES.map((v) => (
                  <option key={v} value={v}>
                    {v.toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {controlMsg && (
            <div className="mb-2 rounded-xl border border-[#FF3D7F]/30 bg-[#FF3D7F]/10 px-3 py-2 text-[11px] text-[#FFC2D8]">
              {controlMsg}
            </div>
          )}

          <p className="text-[10px] leading-relaxed text-[#6A8A99]">
            Autotrade OFF setiap kali aplikasi dibuka sampai kamu menyalakannya. DEMO boleh
            autotrade tanpa LIVE ENABLE. REAL wajib LIVE ENABLE = ENABLED. EA tetap wajib lolos:
            akun demo/real · confidence ≥ {DEFAULT_TRADING_AI_CONFIG.brain.minConfidenceToEnter} ·
            max 1 posisi · spread ≤ {DEFAULT_TRADING_AI_CONFIG.risk.maxSpreadPoints} point ·{" "}
            <code>InpAllowTrading=true</code>. Emergency stop menghentikan entry baru; posisi
            berjalan hanya ditutup kalau opsi di atas dicentang.
          </p>
        </div>

        {/* Live signal + order journal from MT5 */}
        <div className="cp-panel mb-4 rounded-2xl p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#FFB14A]">
              <Activity size={13} /> sinyal & order live
            </p>
            <button
              type="button"
              onClick={() => void refreshActivity()}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[10px] text-[#9BC5D4]"
            >
              <RefreshCw size={11} /> refresh
            </button>
          </div>

          <p className="mb-3 text-[11px] leading-relaxed text-[#9BC5D4]">{activity.openHint}</p>

          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-white/5 bg-black/25 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wider text-[#6A8A99]">Sinyal sekarang</p>
              <p
                className={`mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-sm font-bold ${decisionChip(activity.signal.decision)}`}
              >
                {(activity.signal.decision || "—").toUpperCase()}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/25 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wider text-[#6A8A99]">Confidence</p>
              <p className="mt-1 text-sm font-semibold text-[#E8F7FF]">
                {activity.signal.confidence != null ? activity.signal.confidence : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/25 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wider text-[#6A8A99]">Auto / Live / Exec</p>
              <p className="mt-1 text-sm font-semibold text-[#E8F7FF]">
                {activity.signal.autotrade ? "AUTO ON" : "AUTO OFF"}
                {" · "}
                {activity.signal.liveEnable ? "LIVE ON" : "LIVE OFF"}
                {" · "}
                {activity.signal.serverExecutable ? "READY" : "HOLD"}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/25 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wider text-[#6A8A99]">M5 / M1</p>
              <p className="mt-1 text-sm font-semibold text-[#E8F7FF]">
                {activity.signal.m5Bias ?? "—"} / {activity.signal.m1Direction ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/25 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wider text-[#6A8A99]">Akun</p>
              <p className="mt-1 text-sm font-semibold text-[#E8F7FF]">
                {activity.signal.accountMode ?? "—"}
                {activity.signal.accountLogin != null
                  ? ` · ${activity.signal.accountLogin}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="mb-2 flex flex-wrap gap-3 text-[10px] text-[#6A8A99]">
            <span>spread: {activity.signal.spread ?? "—"}</span>
            <span>estop: {activity.signal.emergencyStop ? "ON" : "off"}</span>
            <span className="break-all">id: {activity.signal.signalId ?? "—"}</span>
          </div>

          <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-[#6A8A99]">
            riwayat order EA
          </p>
          {activity.orders.length === 0 ? (
            <p className="text-[11px] text-[#6A8A99]">
              Belum ada order tercatat. Setelah EA FILLED/FAILED, barisnya muncul di sini.
            </p>
          ) : (
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {activity.orders.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-[11px]"
                >
                  <div className="min-w-0">
                    <span
                      className={`mr-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${orderStatusChip(o.status)}`}
                    >
                      {o.status}
                    </span>
                    <span className="font-semibold text-[#E8F7FF]">
                      {o.direction || "—"} {o.lot != null ? o.lot : ""}
                    </span>
                    <span className="ml-2 text-[#6A8A99]">
                      @ {o.entryPrice != null ? o.entryPrice : "—"}
                      {o.ticket != null ? ` · tiket ${o.ticket}` : ""}
                    </span>
                    {o.errorMessage ? (
                      <p className="mt-0.5 text-[10px] text-[#FFC2D8]">{o.errorMessage}</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-[10px] text-[#6A8A99]">
                    {o.createdAt
                      ? new Date(o.createdAt).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })
                      : "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Otak MetaTrader — connection status */}
        <div className="cp-panel mb-4 rounded-2xl p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#5CE1FF]/90">
              <PlugZap size={13} /> Otak MetaTrader · bridge status
            </p>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-wider ${STATE_STYLE[health.state].chip}`}
              >
                {STATE_STYLE[health.state].label}
              </span>
              <button
                type="button"
                disabled={healthBusy}
                onClick={() => void refreshHealth()}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[10px] text-[#9BC5D4] disabled:opacity-50"
              >
                <RefreshCw size={11} className={healthBusy ? "animate-spin" : ""} />
                cek ulang
              </button>
            </div>
          </div>

          <p className="mb-3 text-[11px] leading-relaxed text-[#9BC5D4]">{health.summary}</p>

          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            {health.channels.map((ch) => (
              <div
                key={ch.id}
                className="rounded-xl border border-white/5 bg-black/25 px-3 py-2.5"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[9px] uppercase tracking-wider text-[#6A8A99]">{ch.label}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${STATE_STYLE[ch.state].chip}`}
                  >
                    {ch.state}
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#E8F7FF]">{ch.expert}</p>
                <p className="mt-1 text-[10px] text-[#6A8A99]">
                  heartbeat: {fmtAge(ch.ageSec)}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-[#9BC5D4]">{ch.detail}</p>
              </div>
            ))}
          </div>

          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Jam MT5 (chart)", formatMt5DateTime(brokerNowSec), gmtLabel],
              ["Jam PC (lokal)", fmtLocalNow(clockTick), "referensi saja"],
              ["Akun MT5", health.account.mode ?? "—", health.account.login != null ? `login ${health.account.login}` : "login —"],
              ["Last decision", health.account.lastDecision ?? "—", "dari executor"],
              [
                "Autotrade",
                health.account.emergencyStop
                  ? "STOP"
                  : health.account.autotrade
                    ? "ON"
                    : "OFF",
                "dashboard",
              ],
            ].map(([k, v, sub]) => (
              <div key={k} className="rounded-xl border border-white/5 bg-black/25 px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wider text-[#6A8A99]">{k}</p>
                <p className="mt-1 text-sm font-semibold text-[#E8F7FF]">{v}</p>
                <p className="mt-0.5 text-[10px] text-[#6A8A99]">{sub}</p>
              </div>
            ))}
          </div>

          {!brokerNowSec && (
            <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100">
              Jam MT5 belum terbaca. Jalankan SQL migrasi{" "}
              <code className="text-amber-200">20260813_trading_ai_broker_time.sql</code>, lalu
              recompile / pasang ulang GercepTradeExecutor supaya mengirim{" "}
              <code className="text-amber-200">broker_time</code>.
            </div>
          )}

          {(healthErr || health.state === "ERROR") && (
            <div className="mb-3 rounded-xl border border-[#FF3D7F]/30 bg-[#FF3D7F]/10 px-3 py-2 text-[11px] text-[#FFC2D8]">
              {healthErr || health.summary}
            </div>
          )}

          <details className="mb-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-[10px] text-[#6A8A99]">
            <summary className="cursor-pointer text-[#9BC5D4]">
              Log probe terakhir
              {healthLatencyMs != null ? ` · round-trip ${healthLatencyMs}ms` : ""}
            </summary>
            <ul className="mt-2 space-y-1 font-mono">
              {health.probes.map((p) => (
                <li key={`${p.target}-${p.startedAt}`}>
                  [{new Date(p.startedAt).toLocaleTimeString("id-ID")}] {p.target} ·{" "}
                  {p.ok ? "OK" : "FAIL"} · {p.latencyMs}ms
                  {p.errorCode ? ` · ${p.errorCode}` : ""}
                  {p.errorMessage ? ` · ${p.errorMessage}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-2 break-all text-[#5CE1FF]">{healthUrl}</p>
          </details>

          <p className="text-[10px] leading-relaxed text-[#6A8A99]">
            CONNECTED hanya muncul setelah EA MT5 mengirim heartbeat nyata (candle push
            dan/atau signal poll) dalam {health.healthyWindowSec}s terakhir. API Gercep
            hidup saja tidak cukup. Timeout cek {BRIDGE_PROBE_TIMEOUT_MS / 1000}s · poll
            setiap {HEALTH_POLL_MS / 1000}s · tidak mengirim order.
          </p>
        </div>

        {/* MT5 bridge */}
        <div className="cp-panel mb-4 rounded-2xl p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#00F0A8]/90">
              <Radio size={13} /> MT5 bridge · candle + signal
            </p>
            <p className="text-[10px] text-[#6A8A99]">server tidak OrderSend · EA demo-only</p>
          </div>

          {!schemaReady && (
            <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100">
              Jalankan SQL migrasi <code className="text-amber-200">20260807_trading_ai_mt5_ingest.sql</code> di Supabase dulu.
              {schemaError ? ` (${schemaError})` : ""}
            </div>
          )}

          <div className="mb-4 grid gap-2 sm:grid-cols-4">
            {[
              ["M5 bars", String(feed.m5Count)],
              ["M1 bars", String(feed.m1Count)],
              ["M5 last (jam MT5)", fmtTs(feed.m5LastTime)],
              ["M1 last (jam MT5)", fmtTs(feed.m1LastTime)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/5 bg-black/25 px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wider text-[#6A8A99]">{k}</p>
                <p className="mt-1 text-sm font-semibold text-[#E8F7FF]">{v}</p>
              </div>
            ))}
          </div>
          <p className="mb-3 text-[10px] text-[#6A8A99]">
            Jam candle di atas = jam chart MetaTrader (bukan jam PC). Bandingkan dengan
            pojok chart XAUUSD.
          </p>

          <div className="mb-3 space-y-2">
            <div className="rounded-xl border border-white/5 bg-black/30 px-3 py-2 text-[11px] text-[#9BC5D4]">
              <div className="mb-1 flex items-center gap-2 text-[#5CE1FF]">
                <Link2 size={12} /> Ingest URL (candle push)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all text-[#E8F7FF]">{ingestUrl}</code>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#5CE1FF]/30 px-2 py-1 text-[10px] text-[#5CE1FF]"
                  onClick={() => navigator.clipboard.writeText(ingestUrl)}
                >
                  <Copy size={11} /> copy
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/30 px-3 py-2 text-[11px] text-[#9BC5D4]">
              <div className="mb-1 flex items-center gap-2 text-[#FFB14A]">
                <Link2 size={12} /> Signal URL (EA executor poll)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all text-[#E8F7FF]">{signalUrl}</code>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#FFB14A]/30 px-2 py-1 text-[10px] text-[#FFB14A]"
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
              className="rounded-xl border border-[#00F0A8]/40 bg-[#00F0A8]/10 px-3 py-2 text-xs font-semibold text-[#00F0A8] disabled:opacity-50"
            >
              {keyBusy ? "..." : "+ Buat API key EA"}
            </button>
            <button
              type="button"
              onClick={() => refreshFeed()}
              className="rounded-xl border border-white/15 px-3 py-2 text-xs text-[#9BC5D4]"
            >
              Refresh feed
            </button>
            <button
              type="button"
              disabled={running}
              onClick={runFromMt5}
              className="cp-btn rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-55"
            >
              Jalankan otak dari data MT5
            </button>
          </div>

          {keyFlash && (
            <div className="mb-3 rounded-xl border border-[#00F0A8]/35 bg-[#00F0A8]/10 px-3 py-2 text-[11px] text-[#B8FFE8]">
              Key baru (simpan sekarang):{" "}
              <code className="break-all text-white">{keyFlash}</code>
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => navigator.clipboard.writeText(keyFlash)}
              >
                copy
              </button>
            </div>
          )}

          {keys.length > 0 && (
            <div className="mb-3 divide-y divide-white/5 rounded-xl border border-white/5">
              {keys.map((k) => (
                <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px]">
                  <div>
                    <p className="font-semibold text-[#E8F7FF]">{k.label}</p>
                    <p className="text-[#6A8A99]">
                      {k.api_key.slice(0, 12)}… · last seen {k.last_seen_at ? new Date(k.last_seen_at).toLocaleString("id-ID") : "belum"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revokeKey(k.id)}
                    className="text-[#FF3D7F] underline"
                  >
                    cabut
                  </button>
                </div>
              ))}
            </div>
          )}

          <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-[#8FB8C9]">
            <li>Jalankan SQL migrasi Trading AI di Supabase (kalau belum).</li>
            <li>Buat API key, paste ke <code className="text-[#5CE1FF]">GercepCandlePush.mq5</code> + <code className="text-[#FFB14A]">GercepTradeExecutor.mq5</code>.</li>
            <li>MT5 → Allow WebRequest → domain Gercep. Attach kedua EA ke XAUUSD (demo atau real).</li>
            <li>Server: set env <code className="text-[#FFB14A]">TRADING_AI_EA_SIGNALS=1</code> supaya <code>eaMayExecute</code> true.</li>
            <li>
              Executor: set <code>InpRequireDemo=false</code> untuk akun real, lalu flip{" "}
              <code>InpAllowTrading=true</code> hanya setelah sinyal terlihat benar.
            </li>
            <li>
              Max 1 posisi · no averaging / grid / hedge. Auto-execute demo/real —
              contest ditolak. Compile ulang EA ke folder Advisors setelah update.
            </li>
          </ol>
          {bridgeMsg && <p className="mt-3 text-[11px] text-[#FFB4D4]">{bridgeMsg}</p>}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Decision hologram */}
          <div className="cp-panel overflow-hidden rounded-2xl p-5 sm:p-7">
            <div className="cp-scanline" />
            <div className="relative z-[1] mb-5 flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#5CE1FF]/70">Decision core</p>
              <span className="text-[10px] text-[#6A8A99]">
                executable: {String(result?.executable ?? false)}
                {result?.execution?.accountMode ? ` · ${result.execution.accountMode}` : ""}
              </span>
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

            <button
              type="button"
              onClick={runExplain}
              disabled={!result || explainBusy}
              className="relative z-[1] mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#5CE1FF]/40 bg-[#5CE1FF]/10 py-3 text-sm font-semibold text-[#5CE1FF] disabled:opacity-45"
            >
              {explainBusy ? (
                <>
                  <Radar size={16} className="animate-spin" /> Claude menjelaskan…
                </>
              ) : (
                <>
                  <MessageSquareText size={16} /> Jelaskan sinyal (Claude)
                </>
              )}
            </button>
            {explainErr && (
              <p className="relative z-[1] mt-2 text-[11px] text-[#FFB4D4]">{explainErr}</p>
            )}
            {explainText && (
              <div className="relative z-[1] mt-3 whitespace-pre-wrap rounded-xl border border-[#5CE1FF]/20 bg-black/40 px-3 py-3 text-[11px] leading-relaxed text-[#C8E7F2]">
                {explainText}
              </div>
            )}
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

        {/* CSV Backtest */}
        <div className="cp-panel mt-4 rounded-2xl p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#FF3D9A]/90">
              CSV backtest · otak tidak diubah
            </p>
            <p className="text-[10px] text-[#6A8A99]">MT5 export · belum order live</p>
          </div>
          <p className="mb-4 text-[11px] leading-relaxed text-[#8FB8C9]">
            Upload candle M5 + M1 (CSV). Format MT5 OK:{" "}
            <span className="text-[#5CE1FF]">DATE,TIME,OPEN,HIGH,LOW,CLOSE</span> atau header{" "}
            <span className="text-[#5CE1FF]">time,open,high,low,close</span>. Brain yang sama dipakai replay.
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="cursor-pointer rounded-xl border border-dashed border-[#5CE1FF]/35 bg-black/25 px-4 py-4 transition hover:border-[#5CE1FF]/70">
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
            <label className="cursor-pointer rounded-xl border border-dashed border-[#FF3D9A]/35 bg-black/25 px-4 py-4 transition hover:border-[#FF3D9A]/70">
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
            className="cp-btn mb-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold tracking-wide disabled:opacity-55"
          >
            {btRunning ? (
              <>
                <Radar size={16} className="animate-spin" /> Rewinding tape…
              </>
            ) : (
              <>
                <Activity size={16} /> Jalankan backtest CSV
              </>
            )}
          </button>
          {btMsg && <p className="mb-3 text-[11px] leading-relaxed text-[#9BC5D4]">{btMsg}</p>}
          {btResult && (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Trades", String(btResult.trades.length)],
                  ["Wins", String(btResult.wins)],
                  ["Losses", String(btResult.losses)],
                  ["PnL≈", btResult.totalPnl.toFixed(2)],
                  ["Max DD≈", btResult.maxDrawdown.toFixed(2)],
                  [
                    "Winrate",
                    btResult.trades.length
                      ? `${Math.round((btResult.wins / btResult.trades.length) * 100)}%`
                      : "—",
                  ],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-white/5 bg-black/25 px-3 py-2.5">
                    <p className="text-[9px] uppercase tracking-wider text-[#6A8A99]">{k}</p>
                    <p className="mt-1 text-sm font-semibold text-[#E8F7FF]">{v}</p>
                  </div>
                ))}
              </div>
              {btResult.trades.length > 0 && (
                <div className="max-h-56 overflow-auto divide-y divide-white/5 rounded-xl border border-white/5">
                  {btResult.trades.slice(0, 30).map((t, i) => (
                    <div key={`${t.entryTime}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px]">
                      <span className="font-bold" style={{ color: decisionColor(t.side) }}>
                        {t.side}
                      </span>
                      <span className="text-[#7FA4B3]">
                        {t.entryPrice.toFixed(2)} → {t.exitPrice?.toFixed(2) ?? "—"}
                      </span>
                      <span style={{ color: (t.pnl ?? 0) >= 0 ? "#00F0A8" : "#FF3D7F" }}>
                        {(t.pnl ?? 0) >= 0 ? "+" : ""}
                        {(t.pnl ?? 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
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
          Phase UI · CSV backtest · otak kamu utuh · Supported by Gercep AI
        </p>
      </div>
    </div>
  );
}
