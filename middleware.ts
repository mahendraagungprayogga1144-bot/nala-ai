import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name) => req.cookies.get(name)?.value, set: () => {}, remove: () => {} } }
    );
    const { data: { session } } = await supabase.auth.getSession();
    if (!session && req.nextUrl.pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/auth", req.url));
    }
  } catch {
    // Allow access if auth check fails
  }
  
  return res;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};