import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import SmartProfitClient from "./smart-profit-client";

export default async function SmartProfitPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const activeBusinessId = cookieStore.get("active_business_id")?.value;

  const { data: businessData } = await supabase
    .from("businesses")
    .select("id, name, type")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: true });

  const business = businessData?.find(b => b.id === activeBusinessId) || businessData?.[0] || null;

  return (
    <SmartProfitClient
      businessName={business?.name || "Bisnis"}
      businessType={business?.type || null}
    />
  );
}
