import { NextResponse } from "next/server";
import { NotFoundError, SalesError } from "@/lib/henima-sales/types";
import { fieldSalesDb, loadFieldPortal } from "@/lib/henima-tracking/field-sales";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const data = await loadFieldPortal(fieldSalesDb(), token);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof SalesError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.httpStatus });
    }
    console.error("[field-portal]", err);
    return NextResponse.json({ error: "Gagal memuat portal sales." }, { status: 500 });
  }
}
