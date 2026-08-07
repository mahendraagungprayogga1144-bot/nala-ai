/**
 * Trading AI Brain — shared types.
 * Phase 1: architecture only. No MT5 / live orders.
 */

/** Final decision surface — never open a live order from phase 1. */
export type TradeDecision = "BUY" | "SELL" | "WAIT" | "CLOSE";

export type TrendDirection = "bullish" | "bearish" | "ranging" | "unknown";

export type Timeframe = "M1" | "M5" | "M15" | "H1" | "H4" | "D1";

export type SymbolCode = "XAUUSD";

/** OHLC candle — provider-agnostic (MT5 later). */
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
  /** Floating P/L in account currency (placeholder). */
  floatingPnl: number;
};

export type TrendAnalysis = {
  timeframe: Timeframe;
  direction: TrendDirection;
  /** 0–1 how clear the structure is. */
  strength: number;
  notes: string[];
};

export type SrLevel = {
  price: number;
  kind: "support" | "resistance";
  /** Touches / how many times price respected this zone. */
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
  /** Depth of pullback vs swing (0–1). */
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
  decision: Extract<TradeDecision, "BUY" | "SELL" | "WAIT">;
  reason: string;
  suggestedStopLoss: number | null;
  suggestedTakeProfit: number | null;
  suggestedLot: number | null;
};

export type ExitSignal = {
  decision: Extract<TradeDecision, "CLOSE" | "WAIT">;
  reason: string;
  positionId: string | null;
};

export type RiskCheck = {
  allowed: boolean;
  reasons: string[];
};

export type ValidationResult = {
  valid: boolean;
  confidence: number; // 0–100
  failedRules: string[];
  notes: string[];
};

/** Full orchestrator output — safe for UI / journal / future executor. */
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
  entry: EntrySignal;
  exit: ExitSignal;
  risk: RiskCheck;
  validation: ValidationResult;
  /** Always false in phase 1 — no broker execution. */
  executable: false;
  generatedAt: number;
};

export type JournalEntry = {
  id: string;
  createdAt: number;
  decision: TradeDecision;
  symbol: SymbolCode;
  confidence: number;
  reasons: string[];
  /** Snapshot summary for later review / AI style learning. */
  contextSummary: string;
  outcome?: "win" | "loss" | "breakeven" | "skipped" | null;
  notes?: string;
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
