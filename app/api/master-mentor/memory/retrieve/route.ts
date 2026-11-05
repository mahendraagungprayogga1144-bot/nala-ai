import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import { retrieveMentorContext } from "@/lib/master-mentor/memory-retrieval";
import { MentorValidationError } from "@/lib/master-mentor/types";
import { cleanText } from "@/lib/master-mentor/text";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON tidak valid.", code: "invalid_json" }, { status: 400 });
    }
    const raw = (body || {}) as Record<string, unknown>;
    const query = cleanText(raw.query, 1000);
    if (!query) throw new MentorValidationError("Query wajib diisi.");
    const pack = await retrieveMentorContext(db, owner.userId, {
      query,
      businessId: cleanText(raw.business_id, 80) || null,
      includeFinance: Boolean(raw.include_finance),
    });
    return { context: pack };
  });
}
