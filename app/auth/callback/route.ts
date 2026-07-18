import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ONBOARDING_COOKIE } from "@/lib/supabase/middleware";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const businessId = searchParams.get("business_id");
  const next = searchParams.get("next") || "/onboarding";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/onboarding";

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Sesi tidak valid")}`, origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    const msg = error?.message || "Gagal verifikasi login";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, origin));
  }

  if (businessId && data.user.email) {
    await supabase
      .from("business_members")
      .update({ member_user_id: data.user.id, status: "aktif" })
      .eq("business_id", businessId)
      .eq("member_email", data.user.email)
      .eq("status", "pending");
  }

  const redirect = NextResponse.redirect(new URL(safeNext, origin));

  // Mark onboarding done if user already has a real business
  if (safeNext.startsWith("/dashboard")) {
    redirect.cookies.set(ONBOARDING_COOKIE, "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }

  return redirect;
}
