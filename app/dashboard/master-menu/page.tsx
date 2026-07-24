import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import FnbMenuClient from "../fnb/menu/menu-client";
import { normalizeMenus } from "../fnb/lib/calc";

export default async function MasterMenuPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const activeBusinessId = cookieStore.get("active_business_id")?.value;

  const { data: businessData } = await supabase
    .from("businesses").select("id, type, name").eq("user_id", user!.id).order("created_at", { ascending: true });

  const business = businessData?.find(b => b.id === activeBusinessId) || businessData?.[0] || null;

  if (business?.type !== "kuliner") {
    return <div className="px-8 py-8 text-[#8B8AA0]">Master Menu hanya untuk bisnis Kuliner / F&B.</div>;
  }

  const [{ data: menus }, { data: products }] = await Promise.all([
    supabase
      .from("menus")
      .select("*, menu_recipes(*, products(id, name, cost, stock, category))")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select("id, name, cost, stock, min_stock, category")
      .eq("business_id", business.id)
      .order("name"),
  ]);

  return (
    <div className="w-full min-w-0 px-3 py-3 sm:px-8 sm:py-8">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">Master Menu</h1>
        {business?.name && <span className="max-w-[40%] truncate rounded-full bg-white/5 px-3 py-1 text-xs text-[#8B8AA0]">{business.name}</span>}
      </div>
      <p className="mb-3 hidden text-sm text-[#8B8AA0] sm:mb-6 sm:block">Modul menu mandiri — kelola menu & resep sendiri.</p>
      <FnbMenuClient menus={normalizeMenus(menus || [])} products={products || []} userId={user!.id} businessId={business.id} businessName={business.name} />
    </div>
  );
}
