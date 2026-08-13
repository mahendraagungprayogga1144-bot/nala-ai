import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { collectLiveActivity } from "@/lib/trading-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/trading-ai/activity
 * Snapshot sinyal terakhir + jurnal order untuk panel dashboard.
 * Read-only. Tidak mengirim order.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const activity = await collectLiveActivity(supabase, user.id);
    return NextResponse.json({ ok: true, ...activity });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
