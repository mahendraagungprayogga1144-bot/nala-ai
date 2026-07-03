import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  if (request.nextUrl.pathname.startsWith("/dashboard") && !request.nextUrl.pathname.startsWith("/onboarding")) {
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

    if (user) {
      // Cek apakah user adalah karyawan (bukan owner)
      const { data: memberData } = await supabase
        .from("business_members")
        .select("role, status, business_id")
        .eq("member_user_id", user.id)
        .eq("status", "aktif")
        .limit(1)
        .single();

      if (memberData?.role === "kasir") {
        // Karyawan kasir hanya bisa akses halaman kasir
        const kasirPath = "/dashboard/ai-kasir";
        if (!request.nextUrl.pathname.startsWith(kasirPath)) {
          return NextResponse.redirect(new URL(kasirPath, request.url));
        }
        return response;
      }

      // Owner - cek bisnis seperti biasa
      const { data: business } = await supabase
        .from("businesses")
        .select("type, name")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!business?.type || business.type === "retail" && business.name === "Bisnis Utama") {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
