import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  listCandidates,
  parseCandidateInput,
  proposeMemoryCandidate,
} from "@/lib/master-mentor/memory-candidates-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    const status = new URL(request.url).searchParams.get("status") || "pending";
    const { rows, notice } = await listCandidates(db, owner.userId, status);
    return { candidates: rows, notice };
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
    const input = parseCandidateInput(body);
    const row = await proposeMemoryCandidate(db, owner.userId, input);
    return NextResponse.json({ candidate: row }, { status: 201 });
  });
}
