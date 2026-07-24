import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import CrmPelangganClient from "./crm-pelanggan-client";

export default async function CrmPelangganPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { business } = await getActiveBusiness(supabase, user.id);

  const { data: customers } = business?.id
    ? await supabase.from("module_crm_customers").select("*").eq("business_id", business.id).order("created_at", { ascending: false })
    : { data: [] };

  return (
    <CrmPelangganClient
      businessId={business?.id || ""}
      businessName={business?.name || "Bisnis"}
      userId={user.id}
      customers={customers || []}
    />
  );
}
