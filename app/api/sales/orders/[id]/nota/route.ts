import { NextResponse } from "next/server";
import { withSalesActor } from "@/lib/henima-sales/http";
import { buildOrderNota } from "@/lib/henima-sales/nota";

export const maxDuration = 30;

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withSalesActor(async ({ actor, db }) => {
    const { bytes, filename } = await buildOrderNota(db, actor, id);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  });
}
