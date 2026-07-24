import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export type ActiveBusiness = { id: string; name: string; type: string | null };

export async function getActiveBusiness(expectedType?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, business: null as ActiveBusiness | null };

  const cookieStore = await cookies();
  const activeId = cookieStore.get("active_business_id")?.value;
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, type")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const business =
    businesses?.find((b) => b.id === activeId) ||
    (expectedType ? businesses?.find((b) => b.type === expectedType) : null) ||
    businesses?.[0] ||
    null;

  return { supabase, user, business };
}

export function WrongBizType({ label }: { label: string }) {
  return (
    <div className="px-8 py-12 text-center">
      <p className="mb-2 text-[#8B8AA0]">Modul ini hanya untuk bisnis tipe <strong className="text-[#F0EFF8]">{label}</strong>.</p>
      <p className="text-xs text-[#5A5B7A]">Ganti bisnis aktif di switcher sidebar, atau buat bisnis baru di onboarding.</p>
    </div>
  );
}
