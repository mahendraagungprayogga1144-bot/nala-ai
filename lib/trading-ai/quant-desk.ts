/**
 * Mapping tampilan desk quant. Tidak mengubah Trading Brain / execution.
 * Angka yang tidak ada di jurnal atau feed → null (UI harus N/A).
 */

import type { LiveOrderRow } from "./live-activity";
import type { TradingDecisionResult } from "./types";

export type DeskOpenPosition = {
  side: "BUY" | "SELL";
  lot: number | null;
  entryPrice: number | null;
  ticket: number | null;
  openedAt: string;
  spread: number | null;
  confidence: number | null;
  signalId: string;
};

export function inferOpenPosition(orders: LiveOrderRow[]): DeskOpenPosition | null {
  for (const o of orders) {
    const st = o.status.toUpperCase();
    const dir = (o.direction || "").toUpperCase();
    if (st === "CLOSED") return null;
    if (st === "FILLED" && (dir === "BUY" || dir === "SELL")) {
      return {
        side: dir,
        lot: o.lot,
        entryPrice: o.entryPrice,
        ticket: o.ticket,
        openedAt: o.createdAt,
        spread: o.spread,
        confidence: o.confidence,
        signalId: o.signalId,
      };
    }
  }
  return null;
}

/** Kontrak XAU standar: 100 oz / lot. Estimasi dari harga last vs entry — bukan P/L broker. */
export function estimateGoldFloatingUsd(
  side: "BUY" | "SELL",
  entry: number | null,
  current: number | null,
  lot: number | null,
): number | null {
  if (entry == null || current == null || lot == null) return null;
  if (![entry, current, lot].every(Number.isFinite)) return null;
  const delta = current - entry;
  const signed = side === "BUY" ? delta : -delta;
  return signed * lot * 100;
}

export function goldPoints(from: number | null, to: number | null): number | null {
  if (from == null || to == null || !Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) * 100);
}

export type PipelineStepId =
  | "listen"
  | "detect"
  | "validate"
  | "size"
  | "execute"
  | "monitor"
  | "exit";

export type PipelineStepStatus = "IDLE" | "ACTIVE" | "PASSED" | "BLOCKED" | "ERROR";

export type PipelineStep = {
  id: PipelineStepId;
  n: string;
  label: string;
  status: PipelineStepStatus;
};

export function buildPipeline(input: {
  feedOk: boolean;
  feedAgeSec: number | null;
  decision: string | null;
  confidence: number | null;
  minConfidence: number;
  serverExecutable: boolean | null;
  lastStatus: string | null;
  hasOpenPosition: boolean;
  riskBlocked: boolean;
}): PipelineStep[] {
  const last = (input.lastStatus || "").toUpperCase();
  const d = (input.decision || "").toUpperCase();
  const hasSide = d === "BUY" || d === "SELL" || d === "CLOSE";
  const confOk = (input.confidence ?? 0) >= input.minConfidence;

  const listen: PipelineStepStatus = input.feedOk
    ? "PASSED"
    : input.feedAgeSec != null && input.feedAgeSec > 120
      ? "ERROR"
      : "ACTIVE";

  const detect: PipelineStepStatus =
    listen !== "PASSED" ? "IDLE" : hasSide || d === "WAIT" ? "PASSED" : "ACTIVE";

  let validate: PipelineStepStatus = "IDLE";
  if (detect === "PASSED") {
    if (input.riskBlocked) validate = "BLOCKED";
    else if (hasSide && !confOk) validate = "BLOCKED";
    else if (hasSide || d === "WAIT") validate = "PASSED";
    else validate = "ACTIVE";
  }

  let size: PipelineStepStatus = "IDLE";
  if (validate === "PASSED" && hasSide) {
    size = input.serverExecutable ? "PASSED" : "BLOCKED";
  } else if (validate === "PASSED") {
    size = "IDLE";
  }

  let execute: PipelineStepStatus = "IDLE";
  if (last === "FAILED") execute = "ERROR";
  else if (last === "FILLED" || last === "CLOSED" || last === "CLOSE_FAILED") execute = "PASSED";
  else if (size === "PASSED") execute = "ACTIVE";

  let monitor: PipelineStepStatus = "IDLE";
  if (input.hasOpenPosition) monitor = "ACTIVE";
  else if (execute === "PASSED" && (last === "CLOSED" || last === "CLOSE_FAILED")) monitor = "PASSED";

  let exit: PipelineStepStatus = "IDLE";
  if (last === "CLOSE_FAILED") exit = "ERROR";
  else if (last === "CLOSED") exit = "PASSED";
  else if (input.hasOpenPosition) exit = "IDLE";

  const ids: { id: PipelineStepId; n: string; label: string; status: PipelineStepStatus }[] = [
    { id: "listen", n: "01", label: "LISTEN", status: listen },
    { id: "detect", n: "02", label: "DETECT", status: detect },
    { id: "validate", n: "03", label: "VALIDATE", status: validate },
    { id: "size", n: "04", label: "SIZE", status: size },
    { id: "execute", n: "05", label: "EXECUTE", status: execute },
    { id: "monitor", n: "06", label: "MONITOR", status: monitor },
    { id: "exit", n: "07", label: "EXIT", status: exit },
  ];
  return ids;
}

export type WhyBullet = { ok: boolean; text: string };

/** Alasan deterministik dari otak — bukan Claude. */
export function buildWhySignal(input: {
  decision: string;
  result: TradingDecisionResult | null;
  spreadOk: boolean;
  hasOpenPosition: boolean;
  openHint: string;
}): { headline: string; bullets: WhyBullet[] } {
  const d = input.decision.toUpperCase();
  const r = input.result;
  const bullets: WhyBullet[] = [];
  if (r) {
    bullets.push({
      ok: r.trend.direction === "bullish" || r.trend.direction === "bearish",
      text: `M5 ${r.trend.direction} (strength ${Math.round(r.trend.strength * 100)}%)`,
    });
    bullets.push({
      ok: r.pullback.detected,
      text: r.pullback.detected ? "M1 pullback confirmed" : "M1 pullback belum lengkap",
    });
    bullets.push({
      ok: r.rejection.detected,
      text: r.rejection.detected
        ? `rejection ${r.rejection.side ?? "confirmed"}`
        : "belum ada rejection",
    });
    bullets.push({
      ok: r.momentum.alignedWithTrend,
      text: `M1 momentum ${r.momentum.direction}${r.momentum.alignedWithTrend ? " aligned" : " belum aligned"}`,
    });
    bullets.push({
      ok: r.risk.allowed,
      text: r.risk.allowed ? "risk gate PASS" : `risk gate BLOCK — ${r.risk.reasons[0] || "blocked"}`,
    });
    bullets.push({
      ok: input.spreadOk,
      text: input.spreadOk ? "spread valid" : "spread di luar batas",
    });
    bullets.push({
      ok: !input.hasOpenPosition,
      text: input.hasOpenPosition ? "ada posisi aktif (limit 1)" : "no active position",
    });
    for (const reason of r.reasons.slice(0, 4)) {
      bullets.push({ ok: d !== "WAIT", text: reason });
    }
  } else {
    bullets.push({ ok: false, text: input.openHint || "Menunggu hasil Trading Brain dari feed live." });
  }

  const headline =
    d === "WAIT"
      ? "WAIT because:"
      : d === "CLOSE"
        ? "CLOSE because:"
        : `${d} because:`;
  return { headline, bullets };
}

export function journalReason(status: string, errorMessage: string | null): string {
  const s = status.toUpperCase();
  const err = (errorMessage || "").toLowerCase();
  if (s === "CLOSED") {
    if (err.includes("recover")) return "SYSTEM STOP";
    return "CLOSED";
  }
  if (s === "CLOSE_FAILED") return "SYSTEM STOP";
  if (s === "FAILED") return "SYSTEM STOP";
  if (s === "FILLED") return "FILLED";
  if (s === "READY") return "READY";
  return s || "N/A";
}

export function entryQuality(confidence: number | null, min: number): string {
  if (confidence == null) return "N/A";
  if (confidence >= 80) return "HIGH";
  if (confidence >= min) return "OK";
  return "WEAK";
}

export function marketRegime(direction: string | null | undefined): "TRENDING" | "RANGE" | "UNCLEAR" {
  const d = (direction || "").toLowerCase();
  if (d === "bullish" || d === "bearish") return "TRENDING";
  if (d === "sideways") return "RANGE";
  return "UNCLEAR";
}

export function countFillsSince(orders: LiveOrderRow[], sinceMs: number): number {
  return orders.filter((o) => {
    if (o.status.toUpperCase() !== "FILLED") return false;
    const t = Date.parse(o.createdAt);
    return Number.isFinite(t) && t >= sinceMs;
  }).length;
}

export function durationLabel(openedAt: string | null, nowMs: number): string {
  if (!openedAt) return "N/A";
  const t = Date.parse(openedAt);
  if (!Number.isFinite(t)) return "N/A";
  const sec = Math.max(0, Math.round((nowMs - t) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${String(s).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
