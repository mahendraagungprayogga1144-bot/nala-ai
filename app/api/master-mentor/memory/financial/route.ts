import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  createFinancialRecord,
  listFinancialRecords,
  parseFinancialInput,
} from "@/lib/master-mentor/financial-memory-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    const url = new URL(request.url);
    const { rows, notice } = await listFinancialRecords(db, owner.userId, {
      businessId: url.searchParams.get("businessId") || undefined,
      q: url.searchParams.get("q") || undefined,
      certainty: url.searchParams.get("certainty") || undefined,
    });
    return { records: rows, notice };
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
    const input = parseFinancialInput(body);
    const row = await createFinancialRecord(db, owner.userId, input);
    return NextResponse.json({ record: row }, { status: 201 });
  });
}
