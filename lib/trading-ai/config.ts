/**
 * Trading AI Brain — rule configuration.
 * Tunable defaults for XAUUSD M5 trend / M1 entry style.
 */

import type { SymbolCode, Timeframe } from "./types";

export const TRADING_AI_VERSION = "0.7.5-extreme-only";

/**
 * Hard product rules — never weaken from UI.
 * Named aliases match product language (MAX_POSITION, NO_*).
 */
export const HARD_RULES = {
  maxOpenPositions: 1,
  allowAveraging: false,
  allowMartingale: false,
  allowGrid: false,
  allowHedge: false,
  /** Server itself never calls a broker API. EA is the only executor. */
  liveTradingEnabled: false,
  /** Server-side MT5 order API disabled; signal poll is separate. */
  mt5Enabled: false,
  /**
   * Pintu eksekusi akun real (live). true = gate menerima account_mode=demo|real.
   * Contest/unknown tetap ditolak. EA tetap wajib InpAllowTrading + autotrade ON.
   */
  ALLOW_LIVE_EXECUTION: true,
  /** Explicit aliases for validators / audit. */
  MAX_POSITION: 1,
  NO_AVERAGING: true,
  NO_MARTINGALE: true,
  NO_GRID: true,
  NO_HEDGE: true,
} as const;

/**
 * Lantai confidence untuk eksekusi otomatis (samakan dengan EA InpMinConfidence).
 * Config brain boleh diturunkan untuk riset/backtest, tapi gate eksekusi
 * tidak pernah turun di bawah angka ini.
 */
export const EXECUTION_MIN_CONFIDENCE = 65;

/** Gerbang tunggal: true bila eksekusi akun real diizinkan produk. */
export function isLiveExecutionAllowed(): boolean {
  return HARD_RULES.ALLOW_LIVE_EXECUTION as boolean;
}

/** Env gate: when "1", signal responses may mark executable (demo/real via gate). */
export function isEaSignalExecutionEnabled(): boolean {
  return process.env.TRADING_AI_EA_SIGNALS === "1";
}

export type TradingAiConfig = {
  symbol: SymbolCode;
  trendTimeframe: Timeframe;
  entryTimeframe: Timeframe;
  /** Prefer price action over classic oscillators. */
  primaryApproach: "price_action";
  useIndicatorsAsPrimary: false;
  risk: {
    maxOpenPositions: number;
    defaultLot: number;
    maxLot: number;
    /** Max floating loss as fraction of balance (placeholder until account feed exists). */
    maxFloatingRiskPct: number;
    /** Reject entry if spread (points) above this. */
    maxSpreadPoints: number;
  };
  brain: {
    /** Min M5 candles required before analyzing trend. */
    minM5Candles: number;
    minM1Candles: number;
    /** Pullback depth band that still counts as valid (fraction of last swing). */
    pullbackMinDepth: number;
    pullbackMaxDepth: number;
    /**
     * Tolok ukur depth pullback.
     * "level"   — vs jarak ke S/R target (perilaku lama; depth ~1.0 saat menyentuh level,
     *             sehingga pullbackMaxDepth praktis tidak berlaku).
     * "impulse" — vs panjang kaki impuls (retracement klasik; pullbackMaxDepth berlaku).
     */
    pullbackDepthBasis: "level" | "impulse";
    /** Min confidence (0–100) to allow BUY/SELL instead of WAIT. */
    minConfidenceToEnter: number;
    /** Swing pivot left/right bars (price action structure). */
    swingLeft: number;
    swingRight: number;
    /** S/R cluster width as multiple of ATR. */
    srAtrMult: number;
    /** How close price must be to level (ATR mult) for pullback/rejection. */
    levelTouchAtrMult: number;
    /** Reward:risk for suggested TP from SL distance. */
    takeProfitRr: number;
  };
};

export const DEFAULT_TRADING_AI_CONFIG: TradingAiConfig = {
  symbol: "XAUUSD",
  trendTimeframe: "M5",
  entryTimeframe: "M1",
  primaryApproach: "price_action",
  useIndicatorsAsPrimary: false,
  risk: {
    maxOpenPositions: HARD_RULES.MAX_POSITION,
    /** Lot default; boleh di-override dari dashboard (execution_control.lot). */
    defaultLot: 0.1,
    /** Batas atas lot dari dashboard / sinyal. */
    maxLot: 1.0,
    maxFloatingRiskPct: 2,
    /**
     * XAUUSD (2 desimal, point=0.01) bergerak di ~30-45 point pada kondisi normal.
     * Nilai lama 35 berada di tengah rentang itu, sehingga entry mati setiap kali
     * spread sedikit melebar. 60 tetap memblokir lonjakan berita/rollover.
     */
    maxSpreadPoints: 60,
  },
  brain: {
    minM5Candles: 50,
    minM1Candles: 30,
    pullbackMinDepth: 0.15,
    pullbackMaxDepth: 0.55,
    pullbackDepthBasis: "impulse",
    minConfidenceToEnter: 65,
    swingLeft: 2,
    swingRight: 2,
    srAtrMult: 0.35,
    levelTouchAtrMult: 0.4,
    takeProfitRr: 1.5,
  },
};

export function mergeTradingAiConfig(
  partial?: Partial<TradingAiConfig> & {
    risk?: Partial<TradingAiConfig["risk"]>;
    brain?: Partial<TradingAiConfig["brain"]>;
  },
): TradingAiConfig {
  if (!partial)
    return {
      ...DEFAULT_TRADING_AI_CONFIG,
      risk: { ...DEFAULT_TRADING_AI_CONFIG.risk },
      brain: { ...DEFAULT_TRADING_AI_CONFIG.brain },
    };
  return {
    ...DEFAULT_TRADING_AI_CONFIG,
    ...partial,
    risk: { ...DEFAULT_TRADING_AI_CONFIG.risk, ...partial.risk },
    brain: { ...DEFAULT_TRADING_AI_CONFIG.brain, ...partial.brain },
    useIndicatorsAsPrimary: false,
    primaryApproach: "price_action",
  };
}
