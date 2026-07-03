import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import BarcodeClient from "./barcode-client";

export default async function BarcodePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { business } = await getActiveBusiness(supabase, user!.id);

  const query = supabase.from("products").select("id, name, sku, stock, price, cost, category").eq("user_id", user!.id);
  if (business?.id) query.eq("business_id", business.id);
  const { data: products } = await query.order("name");

  return (
    <BarcodeClient
      businessName={business?.name || "Bisnis"}
      products={(products || []).map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: Number(p.stock),
        price: p.price ? Number(p.price) : null,
        category: p.category,
      }))}
    />
  );
}
