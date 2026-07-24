import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import BarcodeQrClient from "./barcode-qr-client";

export default async function BarcodeQrPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { business } = await getActiveBusiness(supabase, user.id);

  const { data: items } = business?.id
    ? await supabase.from("module_barcodes").select("*").eq("business_id", business.id).order("created_at", { ascending: false })
    : { data: [] };

  return (
    <BarcodeQrClient businessId={business?.id || ""} businessName={business?.name || "Bisnis"} userId={user.id} items={items || []} />
  );
}
