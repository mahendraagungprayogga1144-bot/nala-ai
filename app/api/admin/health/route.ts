import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/admin/settings";

export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;

  const admin = createAdminClient();
  const settings = await getPlatformSettings({ force: true });
  const checks: { name: string; ok: boolean; detail?: string }[] = [];

  // DB
  if (!admin) {
    checks.push({ name: "Service role", ok: false, detail: "SUPABASE_SERVICE_ROLE_KEY missing" });
  } else {
    const { error } = await admin.from("platform_settings").select("key").limit(1);
    checks.push({
      name: "Database",
      ok: !error,
      detail: error?.message || "platform_settings OK",
    });
    const { error: evErr } = await admin.from("app_events").select("id").limit(1);
    checks.push({
      name: "app_events table",
      ok: !evErr,
      detail: evErr?.message || "OK",
    });
    try {
      const { error: authErr } = await admin.auth.admin.listUsers({ perPage: 1 });
      checks.push({ name: "Auth Admin API", ok: !authErr, detail: authErr?.message || "OK" });
    } catch (e) {
      checks.push({
        name: "Auth Admin API",
        ok: false,
        detail: e instanceof Error ? e.message : "fail",
      });
    }
  }

  checks.push({
    name: "Maintenance mode",
    ok: true,
    detail: settings.maintenance_mode ? "ON (users redirected)" : "OFF",
  });
  checks.push({
    name: "App URL setting",
    ok: Boolean(settings.app_url),
    detail: settings.app_url,
  });
  checks.push({
    name: "NEXT_PUBLIC_APP_URL env",
    ok: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    detail: process.env.NEXT_PUBLIC_APP_URL || "not set (fallback to settings/app origin)",
  });

  let recentErrors: unknown[] = [];
  let stalePayments: {
    id: string;
    user_id: string;
    plan: string;
    amount: number;
    invoice_id: string | null;
    created_at: string;
    hours: number;
  }[] = [];

  if (admin) {
    const { data } = await admin
      .from("app_errors")
      .select("id, source, message, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(20);
    recentErrors = data || [];

    const cutoff = new Date(Date.now() - 6 * 3600_000).toISOString();
    const { data: pending } = await admin
      .from("payments")
      .select("id, user_id, plan, amount, invoice_id, created_at")
      .eq("status", "pending")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(20);
    stalePayments = (pending || []).map((p: {
      id: string;
      user_id: string;
      plan: string;
      amount: number;
      invoice_id: string | null;
      created_at: string;
    }) => ({
      ...p,
      hours: Math.floor((Date.now() - new Date(p.created_at).getTime()) / 3600_000),
    }));
  }

  const allOk = checks.every((c) => c.ok || c.name === "Maintenance mode");

  return NextResponse.json({
    ok: allOk,
    checks,
    settingsSummary: {
      trial_days: settings.trial_days,
      signup_open: settings.signup_open,
      demo_enabled: settings.demo_enabled,
      admin_emails: settings.admin_emails,
      payment_wa: settings.payment_wa,
    },
    attention: {
      stalePendingCount: stalePayments.length,
      stalePayments,
      errorCount: recentErrors.length,
    },
    externalChecklist: [
      {
        label: "Supabase Site URL",
        href: "https://supabase.com/dashboard/project/_/auth/url-configuration",
        expect: settings.app_url,
      },
      {
        label: "Supabase SMTP (reset password email)",
        href: "https://supabase.com/dashboard/project/_/auth/smtp",
      },
      {
        label: "Vercel env NEXT_PUBLIC_APP_URL",
        href: "https://vercel.com/dashboard",
        expect: settings.app_url,
      },
    ],
    recentErrors,
  });
}
