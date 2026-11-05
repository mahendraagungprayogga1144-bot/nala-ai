import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  deleteStrategy,
  parseStrategyInput,
  updateStrategy,
} from "@/lib/master-mentor/strategy-memory-service";

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
    const input = parseStrategyInput(body);
    const row = await updateStrategy(db, owner.userId, id, input);
    return { strategy: row };
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withMentorOwner(async ({ owner, db }) => {
    const { id } = await context.params;
    await deleteStrategy(db, owner.userId, id);
    return { ok: true };
  });
}
