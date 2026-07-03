import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import PajakNpwpClient from "./pajak-npwp-client";

export default async function PajakNpwpPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { business } = await getActiveBusiness(supabase, user!.id);
  const now = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();

  const { data: records } = business?.id
    ? await supabase
        .from("module_tax_profiles")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };

  return (
    <PajakNpwpClient
      businessId={business?.id || ""}
      businessName={business?.name || "Bisnis"}
      userId={user!.id}
      bulan={bulan}
      tahun={tahun}
      records={records || []}
    />
  );
}
