import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  deleteFinancialRecord,
  parseFinancialInput,
  updateFinancialRecord,
} from "@/lib/master-mentor/financial-memory-service";

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
    const input = parseFinancialInput(body);
    const row = await updateFinancialRecord(db, owner.userId, id, input);
    return { record: row };
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withMentorOwner(async ({ owner, db }) => {
    const { id } = await context.params;
    await deleteFinancialRecord(db, owner.userId, id);
    return { ok: true };
  });
}
