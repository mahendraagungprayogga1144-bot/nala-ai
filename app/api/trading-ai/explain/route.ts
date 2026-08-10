import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { explainTradingDecision } from "@/lib/trading-ai/ai-explain";
import { EXECUTION_MIN_CONFIDENCE, type TradingDecisionResult } from "@/lib/trading-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/trading-ai/explain
 * Session auth. Input = hasil decideTradingAction.
 * Claude hanya menjelaskan — tidak mengubah keputusan.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { decision?: TradingDecisionResult };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const decision = body.decision;
  if (!decision || typeof decision !== "object" || !decision.decision) {
    return NextResponse.json(
      { error: "Body harus berisi decision (hasil otak Trading AI)." },
      { status: 400 },
    );
  }

  // Never trust client to mark executable. Endpoint ini dashboard-only
  // (tidak ada account mode dari EA), jadi selalu advisory.
  const safe: TradingDecisionResult = {
    ...decision,
    executable: false,
    execution: {
      executable: false,
      accountMode: "unknown",
      minConfidence: EXECUTION_MIN_CONFIDENCE,
      passed: [],
      blockedBy: ["Explain endpoint bersifat advisory — bukan jalur eksekusi EA."],
    },
  };

  const out = await explainTradingDecision(safe);
  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    explanation: out.explanation,
    model: out.model,
    decision: safe.decision,
    confidence: safe.confidence,
    note: "Penjelasan AI saja. Keputusan rule engine tidak diubah. Tidak ada order.",
  });
}
