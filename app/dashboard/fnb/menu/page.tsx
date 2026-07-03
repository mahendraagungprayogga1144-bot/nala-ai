import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import FnbMenuClient from "./menu-client";
import { normalizeMenus } from "../lib/calc";

export default async function FnbMenuPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const activeBusinessId = cookieStore.get("active_business_id")?.value;

  const { data: businessData } = await supabase
    .from("businesses").select("id, type, name").eq("user_id", user!.id).order("created_at", { ascending: true });

  const business = businessData?.find(b => b.id === activeBusinessId) || businessData?.[0] || null;

  if (business?.type !== "kuliner") {
    return (
      <div className="px-8 py-8 text-[#8B8AA0]">
        Modul ini hanya tersedia untuk bisnis F&B / Kuliner.
      </div>
    );
  }

  const { data: menus } = await supabase
    .from("menus")
    .select("*, menu_recipes(*, products(id, name, cost, stock, category))")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const { data: products } = await supabase
    .from("products")
    .select("id, name, cost, stock, min_stock, category")
    .eq("business_id", business.id)
    .order("name");

  return (
    <div className="w-full min-w-0 px-3 py-3 sm:px-8 sm:py-8">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">Master Menu</h1>
        {business?.name && <span className="text-xs text-[#8B8AA0] bg-white/5 px-3 py-1 rounded-full truncate max-w-[40%]">{business.name}</span>}
      </div>
      <p className="mb-3 hidden text-sm text-[#8B8AA0] sm:mb-6 sm:block">Kelola menu, resep bahan, dan lihat untung/rugi otomatis.</p>
      <FnbMenuClient menus={normalizeMenus(menus || [])} products={products || []} userId={user!.id} businessId={business.id} />
    </div>
  );
}
