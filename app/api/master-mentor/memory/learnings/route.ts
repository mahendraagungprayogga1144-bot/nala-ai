import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  createLearning,
  listLearnings,
  parseLearningInput,
} from "@/lib/master-mentor/learning-memory-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    const url = new URL(request.url);
    const { rows, notice } = await listLearnings(db, owner.userId, {
      businessId: url.searchParams.get("businessId") || undefined,
      q: url.searchParams.get("q") || undefined,
    });
    return { learnings: rows, notice };
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
    const input = parseLearningInput(body);
    const row = await createLearning(db, owner.userId, input);
    return NextResponse.json({ learning: row }, { status: 201 });
  });
}
