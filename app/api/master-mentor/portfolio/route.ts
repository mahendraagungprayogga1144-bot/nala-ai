import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  createPortfolioBusiness,
  listPortfolioBusinesses,
  parsePortfolioInput,
} from "@/lib/master-mentor/portfolio-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return withMentorOwner(async ({ owner, db }) => {
    const { rows, notice } = await listPortfolioBusinesses(db, owner.userId);
    return { businesses: rows, notice };
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
    const input = parsePortfolioInput(body);
    if (input.gercep_business_id) {
      const { assertOwnedGercepBusiness } = await import(
        "@/lib/master-mentor/intelligence/resolve-business"
      );
      await assertOwnedGercepBusiness(db, owner.userId, input.gercep_business_id);
    }
    const row = await createPortfolioBusiness(db, owner.userId, input);
    return NextResponse.json({ business: row }, { status: 201 });
  });
}
