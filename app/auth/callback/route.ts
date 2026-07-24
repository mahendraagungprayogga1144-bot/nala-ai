import { createServerClient } from "@supabase/ssr";
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

  // Route handlers MAY set cookies — unlike RSC createClient which has empty setAll.
  let response = NextResponse.redirect(new URL(safeNext, origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.redirect(new URL(safeNext, origin));
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    const msg = error?.message || "Gagal verifikasi login";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, origin));
  }

  // Only activate a pending invite for this exact email + business — never auto-join by business_id alone.
  if (businessId && data.user.email) {
    const uuidOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      businessId,
    );
    if (uuidOk) {
      await supabase
        .from("business_members")
        .update({ member_user_id: data.user.id, status: "aktif" })
        .eq("business_id", businessId)
        .eq("member_email", data.user.email)
        .eq("status", "pending");
    }
  }

  // Mark onboarding done only if user already owns a business
  if (safeNext.startsWith("/dashboard")) {
    const { data: owned } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", data.user.id)
      .limit(1)
      .maybeSingle();
    if (owned?.id) {
      response.cookies.set(ONBOARDING_COOKIE, "1", {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
      });
    }
  }

  return response;
}
