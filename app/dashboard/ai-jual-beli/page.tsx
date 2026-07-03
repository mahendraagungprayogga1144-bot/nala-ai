import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import AiJualBeliClient from "./ai-jual-beli-client";

export default async function AiJualBeliPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { business } = await getActiveBusiness(supabase, user!.id);

  const query = supabase.from("products").select("id, name, price, cost, stock, category").eq("user_id", user!.id);
  if (business?.id) query.eq("business_id", business.id);
  const { data: products } = await query.order("name").limit(100);

  return (
    <AiJualBeliClient
      businessName={business?.name || "Bisnis"}
      products={(products || []).map(p => ({
        id: p.id,
        name: p.name,
        price: p.price ? Number(p.price) : 0,
        cost: p.cost ? Number(p.cost) : 0,
        stock: Number(p.stock),
        category: p.category,
      }))}
    />
  );
}
