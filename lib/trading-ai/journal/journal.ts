/**
 * Trading Journal — in-memory helpers for phase 1.
 * Persist to Supabase later when UI/user identity is wired.
 */

import type { JournalEntry, TradeDecision, TradingDecisionResult } from "../types";

let memory: JournalEntry[] = [];

function id() {
  return `tj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildJournalEntry(
  result: TradingDecisionResult,
  extras?: { notes?: string; outcome?: JournalEntry["outcome"] },
): JournalEntry {
  return {
    id: id(),
    createdAt: result.generatedAt,
    decision: result.decision,
    symbol: result.symbol,
    confidence: result.confidence,
    reasons: result.reasons,
    contextSummary: [
      `trend=${result.trend.direction}`,
      `pullback=${result.pullback.detected}`,
      `rejection=${result.rejection.detected}`,
      `momentum=${result.momentum.alignedWithTrend}`,
    ].join(" · "),
    outcome: extras?.outcome ?? null,
    notes: extras?.notes,
  };
}

/** Phase 1 memory store — swap for DB in a later phase. */
export function appendJournal(entry: JournalEntry): JournalEntry {
  memory = [entry, ...memory].slice(0, 500);
  return entry;
}

export function listJournal(limit = 50): JournalEntry[] {
  return memory.slice(0, limit);
}

export function clearJournalMemory() {
  memory = [];
}

export function filterJournalByDecision(decision: TradeDecision): JournalEntry[] {
  return memory.filter((e) => e.decision === decision);
}
