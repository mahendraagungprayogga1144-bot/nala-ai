import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  getBusinessMemory,
  parseBusinessMemoryInput,
  updateBusinessMemory,
} from "@/lib/master-mentor/business-memory-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withMentorOwner(async ({ owner, db }) => {
    const { id } = await context.params;
    const row = await getBusinessMemory(db, owner.userId, id);
    if (!row) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
    return { business: row };
  });
}

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
    const input = parseBusinessMemoryInput(body);
    const row = await updateBusinessMemory(db, owner.userId, id, input);
    return { business: row };
  });
}
