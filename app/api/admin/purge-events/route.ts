import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/admin/settings";

export async function POST() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "No admin client" }, { status: 500 });

  const settings = await getPlatformSettings();
  const days = Math.max(7, settings.event_retention_days || 90);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const { error, count } = await admin
    .from("app_events")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_logs").insert({
    admin_email: gate.user.email,
    action: "purge_events",
    detail: { cutoff, deleted: count },
  });

  return NextResponse.json({ ok: true, deleted: count, cutoff, retentionDays: days });
}
