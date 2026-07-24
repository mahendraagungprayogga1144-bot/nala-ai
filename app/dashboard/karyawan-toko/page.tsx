import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import KaryawanClient from "../fnb/karyawan/karyawan-client";
import { normalizeBizType } from "@/lib/auth/post-login";

export default async function KaryawanTokoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const activeBusinessId = cookieStore.get("active_business_id")?.value;

  const { data: businessData } = await supabase
    .from("businesses").select("id, type, name").eq("user_id", user.id).order("created_at", { ascending: true });

  const raw = businessData?.find(b => b.id === activeBusinessId) || businessData?.[0] || null;
  const business = raw ? { ...raw, type: normalizeBizType(raw.type) } : null;

  if (business?.type !== "kuliner") {
    return <div className="px-8 py-8 text-[#8B8AA0]">Karyawan Toko hanya untuk bisnis Kuliner / F&B.</div>;
  }

  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  return (
    <div className="w-full min-w-0 px-3 py-3 sm:px-8 sm:py-8">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">Karyawan Toko</h1>
        {business?.name && <span className="max-w-[40%] truncate rounded-full bg-white/5 px-3 py-1 text-xs text-[#8B8AA0]">{business.name}</span>}
      </div>
      <p className="mb-3 hidden text-sm text-[#8B8AA0] sm:mb-6 sm:block">Modul tim mandiri — kelola karyawan & link kasir.</p>
      <KaryawanClient employees={employees || []} userId={user.id} businessId={business.id} businessName={business.name} />
    </div>
  );
}
