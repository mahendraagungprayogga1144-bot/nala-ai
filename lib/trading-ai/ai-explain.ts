/**
 * AI Explain — Claude narrates a TradingDecisionResult.
 * Does NOT change BUY/SELL/WAIT/CLOSE. Brain remains authoritative.
 * Reuses ANTHROPIC_API_KEY (same as Gercep Chat).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { TradingDecisionResult } from "./types";

export type ExplainResult =
  | { ok: true; explanation: string; model: string }
  | { ok: false; error: string };

function buildContext(decision: TradingDecisionResult): string {
  return JSON.stringify(
    {
      decision: decision.decision,
      symbol: decision.symbol,
      confidence: decision.confidence,
      executable: decision.executable,
      execution: {
        accountMode: decision.execution?.accountMode ?? "unknown",
        minConfidence: decision.execution?.minConfidence ?? null,
        blockedBy: decision.execution?.blockedBy?.slice(0, 4) ?? [],
      },
      reasons: decision.reasons.slice(0, 8),
      trend: {
        direction: decision.trend.direction,
        strength: decision.trend.strength,
        notes: decision.trend.notes.slice(0, 3),
      },
      pullback: {
        detected: decision.pullback.detected,
        depth: decision.pullback.depth,
        nearLevel: decision.pullback.nearLevel,
        notes: decision.pullback.notes.slice(0, 2),
      },
      rejection: {
        detected: decision.rejection.detected,
        side: decision.rejection.side,
        atPrice: decision.rejection.atPrice,
        notes: decision.rejection.notes.slice(0, 2),
      },
      momentum: {
        alignedWithTrend: decision.momentum.alignedWithTrend,
        direction: decision.momentum.direction,
        strength: decision.momentum.strength,
        notes: decision.momentum.notes.slice(0, 2),
      },
      entry: {
        decision: decision.entry.decision,
        reason: decision.entry.reason,
        suggestedStopLoss: decision.entry.suggestedStopLoss,
        suggestedTakeProfit: decision.entry.suggestedTakeProfit,
        suggestedLot: decision.entry.suggestedLot,
      },
      exit: {
        decision: decision.exit.decision,
        reason: decision.exit.reason,
        executable: decision.exit.executable,
      },
      risk: decision.risk,
      validation: {
        valid: decision.validation.valid,
        confidence: decision.validation.confidence,
        failedRules: decision.validation.failedRules.slice(0, 5),
      },
    },
    null,
    2,
  );
}

const SYSTEM = `Kamu adalah asisten penjelasan sinyal Trading AI Brain di Gercep AI (XAUUSD, price action).

ATURAN KERAS:
- Keputusan BUY/SELL/WAIT/CLOSE sudah final dari rule engine. Exit engine memakai HOLD/CLOSE. JANGAN mengubah atau merekomendasikan keputusan berbeda.
- Confidence dan audit sudah dihitung rule engine — jangan ubah angka confidence.
- Jangan sarankan averaging, martingale, grid, atau hedge.
- Field "executable" datang dari rule engine, bukan dari kamu. Jangan menyimpulkan sendiri.
  executable=true berarti sinyal ini boleh dieksekusi EA di akun DEMO.
  executable=false berarti hanya advisory; sebutkan alasannya dari execution.blockedBy kalau ada.
- Eksekusi otomatis hanya untuk akun demo. Jangan pernah menyarankan menjalankan ini di akun live/real.
- Jelaskan dalam Bahasa Indonesia, singkat, jelas, tanpa markdown tebal/bintang.
- Format jawaban:
  1) Ringkas keputusan (1 kalimat)
  2) Kenapa (M5 bias + M1 pullback/rejection/momentum) 3-5 bullet pendek pakai strip "-"
  3) Risiko / yang perlu diwaspadai (1-3 poin)
  4) Satu kalimat penutup: status eksekusi (demo auto-execute atau advisory saja).`;

export async function explainTradingDecision(
  decision: TradingDecisionResult,
): Promise<ExplainResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "ANTHROPIC_API_KEY belum dikonfigurasi di server (pakai key Gercep Chat yang sudah ada).",
    };
  }

  const model = "claude-sonnet-4-6";
  const anthropic = new Anthropic({ apiKey });

  try {
    const res = await anthropic.messages.create({
      model,
      max_tokens: 700,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            "Jelaskan keputusan Trading AI Brain berikut. Jangan ubah keputusan.\n\n" +
            buildContext(decision),
        },
      ],
    });

    const text = res.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) {
      return { ok: false, error: "Claude tidak mengembalikan teks." };
    }

    return { ok: true, explanation: text, model };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memanggil Claude";
    return { ok: false, error: msg };
  }
}
