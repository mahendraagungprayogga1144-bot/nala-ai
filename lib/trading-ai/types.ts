/**
 * Trading AI Brain — shared types.
 * Deterministic, auditable. No MT5 orders from this module.
 */

/** Final orchestrator surface. */
export type TradeDecision = "BUY" | "SELL" | "WAIT" | "CLOSE";

export type EntryDecision = "BUY" | "SELL" | "WAIT";
export type ExitDecision = "HOLD" | "CLOSE";

/** M5 market structure labels. */
export type TrendDirection = "bullish" | "bearish" | "sideways" | "unknown";

/** Human-style market regime (audit / signal). */
export type MarketRegime =
  | "TRENDING_BULLISH"
  | "TRENDING_BEARISH"
  | "RANGE"
  | "UNCLEAR";

export type EntryQuality = "WEAK" | "MEDIUM" | "STRONG";

export type Timeframe = "M1" | "M5" | "M15" | "H1" | "H4" | "D1";

export type SymbolCode = "XAUUSD";

/** OHLC candle — provider-agnostic. */
export type Candle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type MarketSnapshot = {
  symbol: SymbolCode;
  bid: number;
  ask: number;
  spread: number;
  /** Epoch ms when this snapshot was taken. */
  at: number;
};

export type OpenPosition = {
  id: string;
  symbol: SymbolCode;
  side: "BUY" | "SELL";
  lot: number;
  openPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  openedAt: number;
  floatingPnl: number;
};

export type TrendAnalysis = {
  timeframe: Timeframe;
  direction: TrendDirection;
  /** Human-style regime label derived from direction / structure. */
  regime: MarketRegime;
  /** 0–1 how clear the structure is (from swings only). */
  strength: number;
  notes: string[];
};

export type SrLevel = {
  price: number;
  kind: "support" | "resistance";
  touches: number;
  strength: number;
};

export type SupportResistanceAnalysis = {
  timeframe: Timeframe;
  levels: SrLevel[];
  nearestSupport: number | null;
  nearestResistance: number | null;
};

export type PullbackAnalysis = {
  detected: boolean;
  /** Depth from OHLC path into S/R (0–1+). */
  depth: number;
  nearLevel: number | null;
  notes: string[];
};

export type RejectionAnalysis = {
  detected: boolean;
  side: "bullish" | "bearish" | null;
  atPrice: number | null;
  notes: string[];
};

export type MomentumAnalysis = {
  alignedWithTrend: boolean;
  direction: TrendDirection;
  strength: number;
  notes: string[];
};

export type BrainContext = {
  symbol: SymbolCode;
  m5Candles: Candle[];
  m1Candles: Candle[];
  market: MarketSnapshot;
  openPositions: OpenPosition[];
};

export type EntrySignal = {
  decision: EntryDecision;
  reason: string;
  suggestedStopLoss: number | null;
  suggestedTakeProfit: number | null;
  suggestedLot: number | null;
  /** Distance from market to working S/R / extreme (price units). */
  entryDistance: number | null;
  entryQuality: EntryQuality;
  /** True when M5 bias contradicts proposed M1 side outside RANGE. */
  consistencyFail: boolean;
};

export type ExitSignal = {
  decision: ExitDecision;
  reason: string;
  positionId: string | null;
  /** CLOSE boleh dieksekusi EA hanya kalau execution gate lolos (demo-only). */
  executable: boolean;
  /** Alasan CLOSE tidak boleh dieksekusi — kosong kalau executable. */
  executionBlockedBy: string[];
};

export type RiskCheck = {
  allowed: boolean;
  reasons: string[];
};

/** One auditable confidence feature (rule engine only — never Claude). */
export type ConfidenceFeature = {
  id: string;
  label: string;
  passed: boolean;
  points: number;
  detail: string;
};

export type ConfidenceBreakdown = {
  score: number; // 0–100
  maxPossible: number;
  features: ConfidenceFeature[];
};

export type ValidationResult = {
  valid: boolean;
  confidence: number; // 0–100 from ConfidenceBreakdown.score
  failedRules: string[];
  passedRules: string[];
  notes: string[];
  breakdown: ConfidenceBreakdown;
};

/** Full orchestrator output. */
export type TradingDecisionResult = {
  decision: TradeDecision;
  symbol: SymbolCode;
  confidence: number;
  reasons: string[];
  trend: TrendAnalysis;
  supportResistance: SupportResistanceAnalysis;
  pullback: PullbackAnalysis;
  rejection: RejectionAnalysis;
  momentum: MomentumAnalysis;
  /** M1 chain state from sequenced setup. */
  m1State: string;
  entryDistance: number | null;
  entryQuality: EntryQuality;
  entry: EntrySignal;
  exit: ExitSignal;
  risk: RiskCheck;
  validation: ValidationResult;
  audit: DecisionAuditLog;
  /**
   * true HANYA kalau execution gate lolos: akun demo + env aktif +
   * decision BUY/SELL/CLOSE + confidence cukup. Lihat execution-gate.ts.
   */
  executable: boolean;
  /** Rincian kenapa executable true/false — untuk audit dan debugging. */
  execution: ExecutionGateSummary;
  generatedAt: number;
};

/** Ringkasan hasil execution gate yang ikut disimpan di hasil & audit. */
export type ExecutionGateSummary = {
  executable: boolean;
  accountMode: "demo" | "contest" | "real" | "unknown";
  minConfidence: number;
  passed: string[];
  blockedBy: string[];
};

/** Deterministic audit snapshot for every decision. */
export type DecisionAuditLog = {
  timestamp: number;
  symbol: SymbolCode;
  m5Trend: TrendDirection;
  m5TrendStrength: number;
  support: number | null;
  resistance: number | null;
  m1Pullback: boolean;
  pullbackDepth: number;
  rejection: boolean;
  rejectionSide: "bullish" | "bearish" | null;
  momentum: boolean;
  confidence: number;
  confidenceFeatures: ConfidenceFeature[];
  decision: TradeDecision;
  entryDecision: EntryDecision;
  exitDecision: ExitDecision;
  rulesPassed: string[];
  rulesFailed: string[];
  reasons: string[];
  /** Jejak izin eksekusi pada saat keputusan dibuat. */
  executable: boolean;
  accountMode: "demo" | "contest" | "real" | "unknown";
  executionBlockedBy: string[];
};

export type JournalEntry = {
  id: string;
  createdAt: number;
  decision: TradeDecision;
  symbol: SymbolCode;
  confidence: number;
  reasons: string[];
  contextSummary: string;
  outcome?: "win" | "loss" | "breakeven" | "skipped" | null;
  notes?: string;
  audit?: DecisionAuditLog;
};

export type BacktestTrade = {
  side: "BUY" | "SELL";
  entryTime: number;
  exitTime: number | null;
  entryPrice: number;
  exitPrice: number | null;
  lot: number;
  pnl: number | null;
  decisionReasons: string[];
};

export type BacktestResult = {
  symbol: SymbolCode;
  from: number;
  to: number;
  trades: BacktestTrade[];
  wins: number;
  losses: number;
  totalPnl: number;
  maxDrawdown: number;
  notes: string[];
};
