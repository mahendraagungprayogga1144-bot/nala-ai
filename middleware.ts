import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_EMAIL = "mahendraagungprayogga1144@gmail.com";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  if (!isProtected || pathname.startsWith("/onboarding")) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Admin route — hanya email tertentu
  if (pathname.startsWith("/admin")) {
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  // Dashboard routes
  if (user) {
    const { data: memberData } = await supabase
      .from("business_members")
      .select("role, status, business_id")
      .eq("member_user_id", user.id)
      .eq("status", "aktif")
      .limit(1)
      .single();

    if (memberData?.role === "kasir") {
      const kasirPath = "/dashboard/ai-kasir";
      if (!pathname.startsWith(kasirPath)) {
        return NextResponse.redirect(new URL(kasirPath, request.url));
      }
      return response;
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("type, name")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!business?.type || business.type === "retail" && business.name === "Bisnis Utama") {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    // Subscription check — set cookie for client-side banner
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status, expired_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (sub?.expired_at && new Date(sub.expired_at) < new Date() && sub.plan !== "free") {
      await supabase.from("subscriptions").update({ plan: "free", status: "expired" }).eq("user_id", user.id);
      response.cookies.set("sub_expired", "1", { path: "/", maxAge: 86400 });
    } else if (sub?.plan && sub.plan !== "free") {
      response.cookies.delete("sub_expired");
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
