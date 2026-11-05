import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  createDecision,
  listDecisions,
  parseDecisionInput,
} from "@/lib/master-mentor/decision-memory-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    const url = new URL(request.url);
    const { rows, notice } = await listDecisions(db, owner.userId, {
      businessId: url.searchParams.get("businessId") || undefined,
      q: url.searchParams.get("q") || undefined,
    });
    return { decisions: rows, notice };
  });
}

export async function POST(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON tidak valid.", code: "invalid_json" }, { status: 400 });
    }
    const input = parseDecisionInput(body);
    const row = await createDecision(db, owner.userId, input);
    return NextResponse.json({ decision: row }, { status: 201 });
  });
}
