import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trackEvent } from "@/lib/admin/track-event";

const buckets = new Map<string, { n: number; reset: number }>();

function rateLimit(userId: string, max = 60, windowMs = 60_000) {
  const now = Date.now();
  const cur = buckets.get(userId);
  if (!cur || now > cur.reset) {
    buckets.set(userId, { n: 1, reset: now + windowMs });
    return true;
  }
  if (cur.n >= max) return false;
  cur.n += 1;
  return true;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(user.id)) {
    return NextResponse.json({ error: "Too many events" }, { status: 429 });
  }

  let body: { event?: string; module?: string; meta?: Record<string, unknown>; path?: string; business_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.event || typeof body.event !== "string") {
    return NextResponse.json({ error: "event required" }, { status: 400 });
  }

  await trackEvent({
    event: body.event.slice(0, 80),
    module: body.module ? String(body.module).slice(0, 60) : undefined,
    meta: body.meta,
    path: body.path ? String(body.path).slice(0, 200) : undefined,
    business_id: body.business_id || null,
    user_id: user.id,
    ua: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
