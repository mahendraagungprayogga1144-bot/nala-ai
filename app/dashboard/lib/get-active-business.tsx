import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { normalizeBizType } from "@/lib/auth/post-login";
import Link from "next/link";

export type ActiveBusiness = { id: string; name: string; type: string | null };

const COOKIE_OPTS = {
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
};

/**
 * Resolve active business. When `expectedType` is set (hub pages), prefer a
 * business of that type over a mismatched cookie — fixes "ga masuk" when the
 * user has multiple businesses (e.g. demo kuliner + ternak).
 */
export async function getActiveBusiness(expectedType?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, business: null as ActiveBusiness | null };

  const cookieStore = await cookies();
  const activeId = cookieStore.get("active_business_id")?.value;
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, type")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const list = (businesses || []).map((b) => ({
    ...b,
    type: b.type ? normalizeBizType(b.type) : b.type,
  }));

  const want = expectedType ? normalizeBizType(expectedType) : undefined;
  const byCookie = activeId ? list.find((b) => b.id === activeId) || null : null;

  let business: ActiveBusiness | null = null;
  if (want) {
    if (byCookie && normalizeBizType(byCookie.type || "") === want) {
      business = byCookie;
    } else {
      business = list.find((b) => normalizeBizType(b.type || "") === want) || null;
    }
  } else {
    business = byCookie || list[0] || null;
  }

  // Align cookie when hub auto-picked a matching business
  if (business && business.id !== activeId) {
    cookieStore.set("active_business_id", business.id, COOKIE_OPTS);
  }

  return { supabase, user, business };
}

export function WrongBizType({ label }: { label: string }) {
  return (
    <div className="px-8 py-12 text-center">
      <p className="mb-2 text-[#8B8AA0]">
        Modul ini hanya untuk bisnis tipe <strong className="text-[#F0EFF8]">{label}</strong>.
      </p>
      <p className="mb-4 text-xs text-[#5A5B7A]">
        Ganti bisnis aktif di switcher sidebar (pojok kiri), atau buat bisnis baru.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link href="/dashboard/owner" className="text-sm text-[#2DD4BF] hover:underline">
          Dashboard Owner
        </Link>
        <Link href="/onboarding?mode=new" className="text-sm text-[#8B8AA0] hover:underline">
          + Bisnis baru
        </Link>
      </div>
    </div>
  );
}
