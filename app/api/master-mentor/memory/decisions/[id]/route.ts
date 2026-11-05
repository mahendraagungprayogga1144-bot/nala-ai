import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  deleteDecision,
  parseDecisionInput,
  updateDecision,
} from "@/lib/master-mentor/decision-memory-service";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withMentorOwner(async ({ owner, db }) => {
    const { id } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON tidak valid.", code: "invalid_json" }, { status: 400 });
    }
    const input = parseDecisionInput(body);
    const row = await updateDecision(db, owner.userId, id, input);
    return { decision: row };
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withMentorOwner(async ({ owner, db }) => {
    const { id } = await context.params;
    await deleteDecision(db, owner.userId, id);
    return { ok: true };
  });
}
