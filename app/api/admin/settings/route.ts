import { NextResponse } from "next/server";
import { requireAdmin, requireOwner } from "@/lib/admin/require-admin";
import { upsertPlatformSettings, type PlatformSettingsMap } from "@/lib/admin/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/auth/admin";

export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;
  return NextResponse.json({ settings: gate.settings, role: gate.role });
}

export async function PATCH(request: Request) {
  const gate = await requireOwner();
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
    "qris_image_url",
    "support_email",
    "app_url",
    "admin_emails",
    "admin_roles",
    "bank_accounts",
    "plan_prices",
    "announcement_enabled",
    "announcement_message",
    "announcement_link",
    "feature_flags",
    "event_retention_days",
  ];

  const patch: Partial<Record<keyof PlatformSettingsMap, unknown>> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if (typeof patch.qris_image_url === "string") {
    const u = patch.qris_image_url.trim();
    patch.qris_image_url =
      !u || u.startsWith("/") || /^https?:\/\//i.test(u) ? u : "";
  }

  // Normalize roles to lowercase emails
  if (patch.admin_roles && typeof patch.admin_roles === "object") {
    const roles: Record<string, string> = {};
    for (const [k, v] of Object.entries(patch.admin_roles as Record<string, string>)) {
      roles[normalizeEmail(k)] = v === "support" ? "support" : "owner";
    }
    patch.admin_roles = roles;
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
