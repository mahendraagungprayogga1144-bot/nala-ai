import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import KaryawanClient from "./karyawan-client";

export default async function KaryawanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const activeBusinessId = cookieStore.get("active_business_id")?.value;

  const { data: businessData } = await supabase
    .from("businesses").select("id, type, name").eq("user_id", user!.id).order("created_at", { ascending: true });

  const business = businessData?.find(b => b.id === activeBusinessId) || businessData?.[0] || null;

  if (business?.type !== "kuliner") {
    return <div className="px-8 py-8 text-[#8B8AA0]">Modul ini hanya tersedia untuk bisnis F&B / Kuliner.</div>;
  }

  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  return (
    <div className="px-3 py-3 sm:px-8 sm:py-8">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">Karyawan</h1>
        {business?.name && <span className="text-xs text-[#8B8AA0] bg-white/5 px-3 py-1 rounded-full truncate max-w-[40%]">{business.name}</span>}
      </div>
      <p className="mb-3 hidden text-sm text-[#8B8AA0] sm:mb-6 sm:block">Kelola karyawan — bagikan link kasir ke HP mereka.</p>
      <KaryawanClient employees={employees || []} userId={user!.id} businessId={business.id} />
    </div>
  );
}
