import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import KasirClient from "./kasir-client";
import { normalizeMenus } from "../lib/calc";

export default async function KasirPage() {
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

  const today = new Date().toISOString().split("T")[0];

  const { data: menus } = await supabase
    .from("menus")
    .select("*, menu_recipes(*, products(id, name, cost, stock))")
    .eq("business_id", business.id)
    .eq("status", "aktif")
    .order("kategori");

  const { data: employees } = await supabase
    .from("employees")
    .select("*, checkins(id, tanggal, jam_masuk, jam_keluar)")
    .eq("business_id", business.id)
    .eq("aktif", true)
    .order("nama");

  const { data: products } = await supabase
    .from("products")
    .select("id, name, stock, min_stock, category")
    .eq("business_id", business.id)
    .order("name");

  const { data: todayOrders } = await supabase
    .from("orders")
    .select("id, total, hpp, laba")
    .eq("business_id", business.id)
    .eq("order_date", today);

  const omzetHariIni = todayOrders?.reduce((s, o) => s + Number(o.total || 0), 0) || 0;
  const labaHariIni = todayOrders?.reduce((s, o) => s + Number(o.laba || 0), 0) || 0;
  const totalOrder = todayOrders?.length || 0;

  return (
    <div className="w-full min-w-0 px-0 py-0 sm:px-8 sm:py-8">
      <div className="mb-1 flex items-center justify-between gap-2 px-3 pt-3 sm:px-0 sm:pt-0">
        <h1 className="text-xl font-semibold sm:text-2xl">
          <span className="bg-gradient-to-r from-[#2DD4BF] to-[#A78BFA] bg-clip-text text-transparent">Kasir</span>
        </h1>
        {business?.name && <span className="max-w-[40%] truncate rounded-full border border-[#2DD4BF]/25 bg-[#2DD4BF]/10 px-3 py-1 text-xs text-[#2DD4BF]">{business.name}</span>}
      </div>
      <p className="mb-3 hidden px-3 text-sm text-[#8B8AA0] sm:mb-6 sm:block sm:px-0">Catat transaksi, stok berkurang otomatis.</p>
      <KasirClient
        menus={normalizeMenus(menus || [])}
        products={products || []}
        employees={employees || []}
        userId={user!.id}
        businessId={business.id}
        businessName={business.name}
        omzetHariIni={omzetHariIni}
        labaHariIni={labaHariIni}
        totalOrder={totalOrder}
        today={today}
      />
    </div>
  );
}
