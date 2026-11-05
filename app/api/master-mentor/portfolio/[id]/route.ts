import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  deletePortfolioBusiness,
  parsePortfolioInput,
  updatePortfolioBusiness,
} from "@/lib/master-mentor/portfolio-service";

export const dynamic = "force-dynamic";

export async function PATCH(
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
    const input = parsePortfolioInput(body);
    const row = await updatePortfolioBusiness(db, owner.userId, id, input);
    return { business: row };
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withMentorOwner(async ({ owner, db }) => {
    const { id } = await context.params;
    await deletePortfolioBusiness(db, owner.userId, id);
    return { ok: true };
  });
}
