import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import KasirClient from "./kasir-client";
import { normalizeMenus } from "../lib/calc";
import { loadActiveMenusForKasir } from "../lib/load-active-menus";
import { todayWib } from "@/lib/date";
import { normalizeBizType } from "@/lib/auth/post-login";
import { guardPage } from "../../lib/page-guard";

export default async function FnbKasirPage() {
  return guardPage("Kasir F&B", async () => {
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

  const [{ menus, error: menusErr, inactiveCount, totalForBusiness, otherBusinessActiveCount }, { data: employees }, { data: products }, { data: todayOrders }] = await Promise.all([
    loadActiveMenusForKasir(supabase, business.id, user.id),
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
    <div className="w-full min-w-0 px-0 py-0 md:px-6 md:py-5 lg:px-8">
      <div className="mb-3 hidden items-center justify-between gap-3 md:mb-4 md:flex">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold lg:text-2xl">
            <span className="bg-gradient-to-r from-[#2DD4BF] to-[#A78BFA] bg-clip-text text-transparent">Kasir F&B</span>
          </h1>
          <p className="mt-0.5 text-xs text-[#8B8AA0]">Menu, order meja, struk, tutup shift.</p>
        </div>
        {business?.name ? (
          <span className="max-w-[40%] shrink-0 truncate rounded-full border border-[#2DD4BF]/25 bg-[#2DD4BF]/10 px-3 py-1 text-xs text-[#2DD4BF]">
            {business.name}
          </span>
        ) : null}
      </div>
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
        menuHint={
          menus.length === 0
            ? otherBusinessActiveCount > 0
              ? `Ada ${otherBusinessActiveCount} menu di bisnis lain. Ganti bisnis aktif di sidebar ke bisnis tempat menu dibuat.`
              : inactiveCount > 0
                ? `Ada ${inactiveCount} menu nonaktif di “${business.name}”. Ubah status jadi Aktif di Master Menu.`
                : totalForBusiness === 0
                  ? `Belum ada menu untuk “${business.name}”. Simpan menu baru (status Aktif), lalu kasir akan terbuka otomatis.`
                  : null
            : null
        }
      />
    </div>
  );
  });
}
