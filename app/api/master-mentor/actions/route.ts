import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  expireStaleActions,
  listActions,
  parseProposeActionInput,
  proposeAction,
} from "@/lib/master-mentor/actions/action-service";
import { MentorValidationError } from "@/lib/master-mentor/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    const url = new URL(request.url);
    await expireStaleActions(db, owner.userId);
    const { rows, notice } = await listActions(db, owner.userId, {
      status: url.searchParams.get("status") || undefined,
      businessId: url.searchParams.get("businessId") || undefined,
    });
    return { actions: rows, notice };
  });
}

export async function POST(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON tidak valid." }, { status: 400 });
    }
    try {
      const input = parseProposeActionInput(body);
      const row = await proposeAction(db, owner.userId, input);
      return NextResponse.json({ action: row }, { status: 201 });
    } catch (err) {
      if (err instanceof MentorValidationError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
      }
      throw err;
    }
  });
}
