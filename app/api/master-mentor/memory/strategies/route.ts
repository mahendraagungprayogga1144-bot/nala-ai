import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  createStrategy,
  listStrategies,
  parseStrategyInput,
} from "@/lib/master-mentor/strategy-memory-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    const url = new URL(request.url);
    const { rows, notice } = await listStrategies(db, owner.userId, {
      businessId: url.searchParams.get("businessId") || undefined,
      q: url.searchParams.get("q") || undefined,
    });
    return { strategies: rows, notice };
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
    const input = parseStrategyInput(body);
    const row = await createStrategy(db, owner.userId, input);
    return NextResponse.json({ strategy: row }, { status: 201 });
  });
}
