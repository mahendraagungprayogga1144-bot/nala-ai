import { NextRequest, NextResponse } from "next/server";

/**
 * Legacy path used by dashboard "unduh invoice" links.
 * Redirect to the public printable page so shared / bookmarked URLs stay consistent.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return NextResponse.redirect(new URL(`/invoice/${id}`, _req.url), 307);
}
