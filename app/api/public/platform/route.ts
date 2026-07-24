import { NextResponse } from "next/server";
import { getPlatformSettings } from "@/lib/admin/settings";

/** Public subset of platform settings (no secrets). */
export async function GET() {
  const s = await getPlatformSettings();
  return NextResponse.json({
    trial_days: s.trial_days,
    signup_open: s.signup_open,
    demo_enabled: s.demo_enabled,
    payment_wa: s.payment_wa,
    support_email: s.support_email,
    app_url: s.app_url,
    maintenance_mode: s.maintenance_mode,
    maintenance_message: s.maintenance_message,
    // Needed so login can route admin team to /admin (emails are not secrets)
    admin_emails: s.admin_emails,
    feature_flags: {
      pwa_banner: s.feature_flags.pwa_banner,
    },
  });
}
