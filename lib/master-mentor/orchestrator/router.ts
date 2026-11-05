import { detectTopics } from "../memory-retrieval";
import type { SpecialistId } from "../agents/types";

export type RoutePlan = {
  specialists: SpecialistId[];
  complex: boolean;
  reasons: string[];
  includeFinance: boolean;
};

const SIMPLE = /^(hai|halo|hi|hello|thanks|terima kasih|makasih|pagi|siang|sore|malam)\b/i;

/**
 * Selective routing — do not call every specialist every time.
 */
export function planSpecialistRoute(question: string): RoutePlan {
  const q = question.trim();
  const reasons: string[] = [];
  if (SIMPLE.test(q) && q.length < 40) {
    return {
      specialists: ["chairman"],
      complex: false,
      reasons: ["simple_greeting"],
      includeFinance: false,
    };
  }

  const topics = detectTopics(q);
  const selected = new Set<SpecialistId>();
  let includeFinance = false;

  if (topics.includes("finance") || /break.?even|roi|modal|cash|hpp|margin/i.test(q)) {
    selected.add("cfo");
    includeFinance = true;
    reasons.push("finance_topic");
  }
  if (topics.includes("strategy") || /posisi|kompetitor|ekspansi|prioritas/i.test(q)) {
    selected.add("strategy");
    reasons.push("strategy_topic");
  }
  if (topics.includes("learning") || /sales|marketing|acquisition|konversi|pricing|harga|retensi|distribusi/i.test(q)) {
    // growth often co-occurs with learning wording; also explicit growth cues
  }
  if (/sales|marketing|acquisition|konversi|pricing|harga jual|retensi|distribusi|iklan|funnel/i.test(q)) {
    selected.add("growth");
    reasons.push("growth_topic");
  }
  if (/sop|operasional|karyawan|produktivitas|inventory|stok|otomatis|proses|workforce/i.test(q)) {
    selected.add("operations");
    reasons.push("operations_topic");
  }
  if (topics.includes("decision") || /risiko|risk|bahaya|ancaman|gagal/i.test(q)) {
    selected.add("risk");
    reasons.push("risk_or_decision");
  }
  if (topics.includes("owner") && selected.size === 0) {
    selected.add("chairman");
    reasons.push("owner_topic");
  }

  // Default: chairman + strategy for open business questions
  if (selected.size === 0) {
    selected.add("strategy");
    selected.add("risk");
    reasons.push("default_business");
  }

  const complex =
    selected.size >= 2 ||
    /bandingkan|rekomendasi|analisis|strategi|keuangan|ekspansi|rencana/i.test(q) ||
    q.length > 160;

  // Chairman always synthesizes for complex multi-specialist runs
  const specialists = Array.from(selected).filter((s) => s !== "chairman") as SpecialistId[];
  if (complex || specialists.length === 0) {
    // run specialists first then chairman; if only one domain keep chairman as synthesizer when complex
  }

  return {
    specialists: specialists.length ? specialists : ["strategy"],
    complex,
    reasons,
    includeFinance: includeFinance || specialists.includes("cfo"),
  };
}
