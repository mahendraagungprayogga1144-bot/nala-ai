import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getPlatformSettings, upsertPlatformSettings, type PlatformSettingsMap } from "@/lib/admin/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;
  const settings = await getPlatformSettings({ force: true });
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;
  const { user } = gate;

  let body: Partial<PlatformSettingsMap>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed: (keyof PlatformSettingsMap)[] = [
    "trial_days",
    "maintenance_mode",
    "maintenance_message",
    "signup_open",
    "demo_enabled",
    "payment_wa",
    "support_email",
    "app_url",
    "admin_emails",
    "feature_flags",
    "event_retention_days",
  ];

  const patch: Partial<Record<keyof PlatformSettingsMap, unknown>> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const settings = await upsertPlatformSettings(patch, user.email || "admin");
    const admin = createAdminClient();
    if (admin) {
      await admin.from("admin_logs").insert({
        admin_email: user.email,
        action: "update_settings",
        detail: { keys: Object.keys(patch) },
      });
    }
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal simpan settings" },
      { status: 500 },
    );
  }
}
