import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  updateSession,
  hasAuthCookie,
  isPlaceholderBusiness,
  ONBOARDING_COOKIE,
  SUB_CHECKED_COOKIE,
  ROLE_CHECKED_COOKIE,
} from "@/lib/supabase/middleware";

const ADMIN_EMAIL = "mahendraagungprayogga1144@gmail.com";

function needsAuth(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname === "/onboarding"
  );
}

function isAuthPage(pathname: string) {
  return pathname === "/login" || pathname === "/signup";
}

function redirectTo(request: NextRequest, path: string, response?: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  // Preserve refreshed auth + gate cookies from the session response
  if (response) {
    response.cookies.getAll().forEach((c) => {
      redirect.cookies.set(c);
    });
  }
  return redirect;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Public pages without session cookie: skip Supabase entirely (fast)
  if (!needsAuth(pathname) && !isAuthPage(pathname) && !hasAuthCookie(request)) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  // Unauthenticated → login
  if (!user && needsAuth(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  if (!user) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Already logged in on login/signup → bounce to app
  if (isAuthPage(pathname)) {
    const dest = await resolveAppHome(supabase, user.id, request, response);
    return redirectTo(request, dest, response);
  }

  // Admin
  if (pathname.startsWith("/admin")) {
    if (user.email !== ADMIN_EMAIL) {
      return redirectTo(request, "/dashboard/owner", response);
    }
    return response;
  }

  // Kasir role lock — cookie skips DB on every navigation after first check
  if (pathname.startsWith("/dashboard") || pathname === "/onboarding") {
    const roleCookie = request.cookies.get(ROLE_CHECKED_COOKIE)?.value;

    if (roleCookie === "kasir") {
      if (pathname === "/onboarding" || !pathname.startsWith("/dashboard/ai-kasir")) {
        return redirectTo(request, "/dashboard/ai-kasir", response);
      }
      return response;
    }

    if (roleCookie !== "owner") {
      const { data: kasirMember } = await supabase
        .from("business_members")
        .select("role")
        .eq("member_user_id", user.id)
        .eq("status", "aktif")
        .eq("role", "kasir")
        .limit(1)
        .maybeSingle();

      if (kasirMember) {
        response.cookies.set(ROLE_CHECKED_COOKIE, "kasir", {
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
          sameSite: "lax",
        });
        if (pathname === "/onboarding" || !pathname.startsWith("/dashboard/ai-kasir")) {
          return redirectTo(request, "/dashboard/ai-kasir", response);
        }
        return response;
      }

      response.cookies.set(ROLE_CHECKED_COOKIE, "owner", {
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
      });
    }
  }

  // Onboarding gate — cookie avoids DB on every navigation
  if (pathname === "/onboarding") {
    const allowNew = request.nextUrl.searchParams.get("mode") === "new";
    if (!allowNew && request.cookies.get(ONBOARDING_COOKIE)?.value === "1") {
      return redirectTo(request, "/dashboard/inventory", response);
    }
    return response;
  }

  if (pathname.startsWith("/dashboard")) {
    const obDone = request.cookies.get(ONBOARDING_COOKIE)?.value === "1";

    if (!obDone) {
      // IMPORTANT: use limit + maybeSingle / list — never .single()
      // (.single() throws when user has 0 OR >1 businesses → false redirect to onboarding)
      const { data: businesses } = await supabase
        .from("businesses")
        .select("type, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(5);

      const hasRealBusiness = (businesses || []).some(
        (b: { type?: string | null; name?: string | null }) => !isPlaceholderBusiness(b),
      );
      if (!hasRealBusiness) {
        return redirectTo(request, "/onboarding", response);
      }
      response.cookies.set(ONBOARDING_COOKIE, "1", {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
      });
    }

    // Subscription / trial check at most once per 5 minutes
    if (!request.cookies.get(SUB_CHECKED_COOKIE)?.value) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan, status, expired_at, trial_ends_at")
        .eq("user_id", user.id)
        .maybeSingle();

      const endAt = sub?.trial_ends_at || sub?.expired_at;
      const ended = endAt ? new Date(endAt) < new Date() : false;
      const isPaidOrTrial = sub?.plan && sub.plan !== "free";

      if (ended && isPaidOrTrial) {
        await supabase
          .from("subscriptions")
          .update({ plan: "free", status: "expired", updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
        response.cookies.set("sub_expired", "1", { path: "/", maxAge: 86400 });
      } else if (sub?.plan === "trial" && endAt) {
        response.cookies.delete("sub_expired");
        const days = Math.ceil((new Date(endAt).getTime() - Date.now()) / 86400000);
        response.cookies.set("trial_days_left", String(Math.max(0, days)), {
          path: "/",
          maxAge: 300,
          sameSite: "lax",
        });
      } else if (isPaidOrTrial) {
        response.cookies.delete("sub_expired");
        response.cookies.delete("trial_days_left");
      }

      response.cookies.set(SUB_CHECKED_COOKIE, "1", {
        path: "/",
        maxAge: 300,
        sameSite: "lax",
      });
    }
  }

  return response;
}

async function resolveAppHome(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  request: NextRequest,
  response: NextResponse,
) {
  if (request.cookies.get(ONBOARDING_COOKIE)?.value === "1") {
    return "/dashboard/inventory";
  }

  const { data: businesses } = await supabase
    .from("businesses")
    .select("type, name")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(5);

  const hasRealBusiness = (businesses || []).some(
    (b: { type?: string | null; name?: string | null }) => !isPlaceholderBusiness(b),
  );
  if (!hasRealBusiness) return "/onboarding";

  response.cookies.set(ONBOARDING_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });

  const type = businesses?.[0]?.type;
  const hubs: Record<string, string> = {
    ternak: "/dashboard/peternakan",
    pertanian: "/dashboard/pertanian",
    retail: "/dashboard/retail",
    jasa: "/dashboard/jasa",
    wholesale: "/dashboard/wholesale",
    olshop: "/dashboard/olshop",
    kesehatan: "/dashboard/kesehatan",
    bengkel: "/dashboard/bengkel",
  };
  return (type && hubs[type]) || "/dashboard/inventory";
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
