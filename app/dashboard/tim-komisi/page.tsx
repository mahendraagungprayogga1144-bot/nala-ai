import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import TimKomisiClient from "./tim-komisi-client";
import { guardPage } from "../lib/page-guard";

export default async function TimKomisiPage() {
  return guardPage("Tim Komisi", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { business } = await getActiveBusiness(supabase, user.id);

  const [{ data: staff }, { data: sales }] = business?.id
    ? await Promise.all([
        supabase.from("module_commission_staff").select("*").eq("business_id", business.id).order("nama"),
        supabase.from("module_commission_sales").select("*, module_commission_staff(nama, komisi_pct)").eq("business_id", business.id).order("tanggal", { ascending: false }).limit(50),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <TimKomisiClient
      businessId={business?.id || ""}
      businessName={business?.name || "Bisnis"}
      userId={user.id}
      staff={staff || []}
      sales={sales || []}
    />
  );
  });
}
