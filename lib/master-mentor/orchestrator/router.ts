import { detectTopics } from "../memory-retrieval";
import type { SpecialistId } from "../agents/types";

export type RoutePlan = {
  specialists: SpecialistId[];
  complex: boolean;
  reasons: string[];
  includeFinance: boolean;
  includeSeo: boolean;
};

const SIMPLE = /^(hai|halo|hi|hello|thanks|terima kasih|makasih|pagi|siang|sore|malam)\b/i;

/**
 * Fast-by-default routing for chat-like UX.
 * Specialists only when owner explicitly asks for deep multi-agent analysis.
 * Otherwise Chairman alone (with finance memory when relevant) — much faster.
 */
export function planSpecialistRoute(question: string): RoutePlan {
  const q = question.trim();
  const reasons: string[] = [];
  const includeFinance =
    detectTopics(q).includes("finance") ||
    /break.?even|bep|roi|modal|cash|\bkas\b|hpp|margin|omzet|laba|revenue|keuangan/i.test(q);
  const includeSeo =
    /seo|keyword|ranking|rank|backlink|serp|organik|organic|search console|trafik web|meta title|ahrefs|semrush|openseo|gercepos\.id/i.test(
      q,
    );

  if (SIMPLE.test(q) && q.length < 40) {
    return {
      specialists: [],
      complex: false,
      reasons: ["simple_greeting"],
      includeFinance: false,
      includeSeo: false,
    };
  }

  const wantDeep =
    /mendalam|pakai spesialis|multi.?agent|analisis penuh|full analysis|dengan cfo|dengan strategy/i.test(
      q,
    );

  if (!wantDeep) {
    reasons.push(includeFinance ? "fast_chairman_finance" : "fast_chairman");
    if (includeSeo) reasons.push("seo_topic");
    return {
      specialists: [],
      complex: q.length > 200 || /analisis|rekomendasi|strategi|bandingkan|seo/i.test(q),
      reasons,
      includeFinance,
      includeSeo,
    };
  }

  const topics = detectTopics(q);
  const selected = new Set<SpecialistId>();
  if (includeFinance) {
    selected.add("cfo");
    reasons.push("finance_topic");
  }
  if (topics.includes("strategy") || /posisi|kompetitor|ekspansi|prioritas/i.test(q)) {
    selected.add("strategy");
    reasons.push("strategy_topic");
  }
  if (
    includeSeo ||
    /sales|marketing|acquisition|konversi|pricing|harga jual|retensi|distribusi|iklan|funnel/i.test(q)
  ) {
    selected.add("growth");
    reasons.push(includeSeo ? "seo_growth_topic" : "growth_topic");
  }
  if (/sop|operasional|karyawan|produktivitas|otomatis|proses|workforce/i.test(q)) {
    selected.add("operations");
    reasons.push("operations_topic");
  }
  if (topics.includes("decision") || /risiko|risk|bahaya|ancaman|gagal/i.test(q)) {
    selected.add("risk");
    reasons.push("risk_or_decision");
  }
  if (selected.size === 0) {
    selected.add("strategy");
    reasons.push("default_deep");
  }

  const specialists = Array.from(selected).filter((s) => s !== "chairman").slice(0, 2) as SpecialistId[];
  return {
    specialists,
    complex: true,
    reasons: [...reasons, "deep_requested"],
    includeFinance: includeFinance || specialists.includes("cfo"),
    includeSeo,
  };
}
