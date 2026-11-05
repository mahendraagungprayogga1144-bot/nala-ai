import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  clearOwnerMemory,
  getOwnerMemory,
  parseOwnerMemoryInput,
  upsertOwnerMemory,
} from "@/lib/master-mentor/owner-memory-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return withMentorOwner(async ({ owner, db }) => {
    const { row, notice } = await getOwnerMemory(db, owner.userId);
    return { memory: row, notice };
  });
}

export async function PUT(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON tidak valid.", code: "invalid_json" }, { status: 400 });
    }
    const input = parseOwnerMemoryInput(body);
    const row = await upsertOwnerMemory(db, owner.userId, input);
    return { memory: row };
  });
}

export async function DELETE() {
  return withMentorOwner(async ({ owner, db }) => {
    await clearOwnerMemory(db, owner.userId);
    return { ok: true };
  });
}
