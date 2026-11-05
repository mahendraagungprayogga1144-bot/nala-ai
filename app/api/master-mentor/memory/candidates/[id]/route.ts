import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import { reviewCandidate } from "@/lib/master-mentor/memory-candidates-service";
import { MentorValidationError } from "@/lib/master-mentor/types";
import { cleanText } from "@/lib/master-mentor/text";

export const dynamic = "force-dynamic";

export async function POST(
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
    const raw = (body || {}) as Record<string, unknown>;
    const action = cleanText(raw.action, 20) as "approve" | "reject" | "correct";
    if (!["approve", "reject", "correct"].includes(action)) {
      throw new MentorValidationError("Action harus approve, reject, atau correct.");
    }
    const row = await reviewCandidate(
      db,
      owner.userId,
      id,
      action,
      cleanText(raw.review_note, 2000),
      raw.corrected_payload && typeof raw.corrected_payload === "object"
        ? (raw.corrected_payload as Record<string, unknown>)
        : undefined,
    );
    return { candidate: row };
  });
}
