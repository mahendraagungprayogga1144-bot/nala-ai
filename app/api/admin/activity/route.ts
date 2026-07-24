import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "No admin client" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
  const cursor = searchParams.get("cursor");
  const event = searchParams.get("event");
  const moduleName = searchParams.get("module");
  const userId = searchParams.get("user_id");

  let q = admin
    .from("app_events")
    .select("id, user_id, business_id, event, module, meta, path, ua, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) q = q.lt("created_at", cursor);
  if (event) q = q.eq("event", event);
  if (moduleName) q = q.eq("module", moduleName);
  if (userId) q = q.eq("user_id", userId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    events: data || [],
    nextCursor: data?.length === limit ? data[data.length - 1]?.created_at : null,
  });
}
