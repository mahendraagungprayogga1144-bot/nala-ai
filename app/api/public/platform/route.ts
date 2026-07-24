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
  });
}
