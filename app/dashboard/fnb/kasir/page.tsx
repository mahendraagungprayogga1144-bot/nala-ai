import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import KasirClient from "./kasir-client";
import { normalizeMenus } from "../lib/calc";
import { loadActiveMenusForKasir } from "../lib/load-active-menus";
import { todayWib } from "@/lib/date";
import { normalizeBizType } from "@/lib/auth/post-login";

export default async function FnbKasirPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const activeBusinessId = cookieStore.get("active_business_id")?.value;

  const { data: businessData } = await supabase
    .from("businesses").select("id, type, name").eq("user_id", user.id).order("created_at", { ascending: true });

  const raw = businessData?.find(b => b.id === activeBusinessId) || businessData?.[0] || null;
  const business = raw ? { ...raw, type: normalizeBizType(raw.type) } : null;

  if (business?.type !== "kuliner") {
    return (
      <div className="mx-auto max-w-lg px-8 py-12 text-center">
        <h1 className="mb-2 text-xl font-semibold">Kasir F&B</h1>
        <p className="text-sm text-[#8B8AA0]">Modul kasir ini khusus bisnis tipe Kuliner / F&B. Ganti bisnis aktif di Multi Bisnis.</p>
        <a href="/dashboard/multi-bisnis" className="mt-4 inline-block text-sm text-[#2DD4BF]">Kelola bisnis →</a>
      </div>
    );
  }

  const today = todayWib();

  const [{ menus, error: menusErr }, { data: employees }, { data: products }, { data: todayOrders }] = await Promise.all([
    loadActiveMenusForKasir(supabase, business.id),
    supabase
      .from("employees")
      .select("*, checkins(id, tanggal, jam_masuk, jam_keluar)")
      .eq("business_id", business.id)
      .eq("aktif", true)
      .eq("checkins.tanggal", today)
      .order("nama"),
    supabase
      .from("products")
      .select("id, name, stock, min_stock, category")
      .eq("business_id", business.id)
      .order("name"),
    supabase
      .from("orders")
      .select("id, total, hpp, laba")
      .eq("business_id", business.id)
      .eq("order_date", today),
  ]);

  if (menusErr) {
    return (
      <div className="px-4 py-10 text-center sm:px-8">
        <p className="mb-2 text-[#EC4899]">Gagal memuat menu kasir.</p>
        <p className="text-xs text-[#8B8AA0]">{menusErr}</p>
      </div>
    );
  }

  const omzetHariIni = todayOrders?.reduce((s, o) => s + Number(o.total || 0), 0) || 0;
  const labaHariIni = todayOrders?.reduce((s, o) => s + Number(o.laba || 0), 0) || 0;
  const totalOrder = todayOrders?.length || 0;

  return (
    <div className="w-full min-w-0 px-0 py-0 sm:px-8 sm:py-8">
      <div className="mb-1 flex items-center justify-between gap-2 px-3 pt-3 sm:px-0 sm:pt-0">
        <h1 className="text-xl font-semibold sm:text-2xl">
          <span className="bg-gradient-to-r from-[#2DD4BF] to-[#A78BFA] bg-clip-text text-transparent">Kasir F&B</span>
        </h1>
        {business?.name && <span className="max-w-[40%] truncate rounded-full border border-[#2DD4BF]/25 bg-[#2DD4BF]/10 px-3 py-1 text-xs text-[#2DD4BF]">{business.name}</span>}
      </div>
      <p className="mb-3 hidden px-3 text-sm text-[#8B8AA0] sm:mb-6 sm:block sm:px-0">Kasir kuliner — menu, order meja, struk, tutup shift.</p>
      <KasirClient
        menus={normalizeMenus(menus as Parameters<typeof normalizeMenus>[0])}
        products={products || []}
        employees={employees || []}
        userId={user.id}
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
