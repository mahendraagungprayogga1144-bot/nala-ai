import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

export type SessionResult = {
  response: NextResponse;
  user: User | null;
};

/** Single auth refresh — call once per request, reuse the returned user. */
export async function updateSession(request: NextRequest): Promise<SessionResult> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { response, user: null };
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}

export function hasAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((c) => c.name.includes("auth-token"));
}

export function isPlaceholderBusiness(b: { type?: string | null; name?: string | null } | null | undefined) {
  if (!b?.type) return true;
  return b.type === "retail" && b.name === "Bisnis Utama";
}

export const ONBOARDING_COOKIE = "ob_done";
export const SUB_CHECKED_COOKIE = "sub_checked";
/** Skip kasir-role DB lookup on subsequent navigations (set after first check). */
export const ROLE_CHECKED_COOKIE = "role_checked";

