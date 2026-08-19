/**
 * Agregasi indikator quant dari jurnal order EA — data sungguhan, bukan dummy.
 */

export type OrderStatInput = {
  status: string;
  direction: string | null;
  createdAt: string;
  errorMessage: string | null;
};

export type QuantStats = {
  fills: number;
  closed: number;
  failed: number;
  closeFailed: number;
  recovered: number;
  fillsToday: number;
  lastFillAt: string | null;
  lastFillSide: string | null;
  lastStatus: string | null;
};

export function emptyQuantStats(): QuantStats {
  return {
    fills: 0,
    closed: 0,
    failed: 0,
    closeFailed: 0,
    recovered: 0,
    fillsToday: 0,
    lastFillAt: null,
    lastFillSide: null,
    lastStatus: null,
  };
}

function startOfLocalDayIso(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function buildQuantStats(orders: OrderStatInput[]): QuantStats {
  const stats = emptyQuantStats();
  const dayStart = startOfLocalDayIso();
  stats.lastStatus = orders[0]?.status ?? null;

  for (const o of orders) {
    const st = o.status.toUpperCase();
    const recovered = (o.errorMessage || "").toLowerCase().includes("recovered");
    if (recovered) stats.recovered += 1;
    if (st === "FILLED") {
      stats.fills += 1;
      const t = Date.parse(o.createdAt);
      if (Number.isFinite(t) && t >= dayStart) stats.fillsToday += 1;
      if (!stats.lastFillAt) {
        stats.lastFillAt = o.createdAt;
        stats.lastFillSide = o.direction;
      }
    } else if (st === "CLOSED") {
      stats.closed += 1;
    } else if (st === "CLOSE_FAILED") {
      stats.closeFailed += 1;
    } else if (st === "FAILED") {
      stats.failed += 1;
    }
  }
  return stats;
}

export type CycleStageId = "detect" | "validate" | "size" | "fill" | "settle";

export function activeCycleStage(input: {
  feedOk: boolean;
  decision: string | null;
  confidence: number | null;
  minConfidence: number;
  serverExecutable: boolean | null;
  lastStatus: string | null;
}): CycleStageId {
  const last = (input.lastStatus || "").toUpperCase();
  if (last === "CLOSED" || last === "CLOSE_FAILED") return "settle";
  if (last === "FILLED" || last === "FAILED") return "fill";
  if (input.serverExecutable === true) return "size";
  const d = (input.decision || "").toUpperCase();
  if (d === "BUY" || d === "SELL" || d === "CLOSE") return "validate";
  if (
    input.feedOk &&
    (d === "WAIT" || !d) &&
    (input.confidence == null || input.confidence < input.minConfidence)
  ) {
    return "detect";
  }
  return input.feedOk ? "validate" : "detect";
}
