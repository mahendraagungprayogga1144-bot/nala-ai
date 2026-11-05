import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import { reviewAction } from "@/lib/master-mentor/actions/action-service";
import { MentorValidationError } from "@/lib/master-mentor/types";
import { cleanText } from "@/lib/master-mentor/text";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withMentorOwner(async ({ owner, db }) => {
    const { id } = await context.params;
    let body: { decision?: string; review_note?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON tidak valid." }, { status: 400 });
    }
    const decision = cleanText(body.decision, 20);
    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json(
        { error: "decision harus approve atau reject." },
        { status: 400 },
      );
    }
    try {
      const row = await reviewAction(db, owner.userId, id, decision, body.review_note || "");
      return { action: row };
    } catch (err) {
      if (err instanceof MentorValidationError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
      }
      throw err;
    }
  });
}
