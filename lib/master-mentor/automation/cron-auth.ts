import { NextResponse } from "next/server";

/**
 * Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
 * Also allow MASTER_MENTOR_CRON_SECRET for isolated rotation.
 */
export function assertCronAuthorized(request: Request): NextResponse | null {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.MASTER_MENTOR_CRON_SECRET?.trim() || "";
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET belum dikonfigurasi di server." },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized cron." }, { status: 401 });
  }
  return null;
}
