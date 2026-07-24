import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import AiKasirClient from "./ai-kasir-client";

export type Product = {
  id: string; name: string; price: number; cost: number;
  stock: number; min_stock: number; category: string | null;
  sku: string | null; barcode?: string | null;
};

export type KasirShift = {
  id: string; modal_awal: number; total_transaksi: number;
  total_order: number; kas_akhir: number;
  opened_at: string; closed_at: string | null; status: string;
};

export type TodayTx = {
  id: string; amount: number; description: string | null;
  category: string | null; created_at: string;
};

export default async function AiKasirPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div className="px-8 py-12 text-center text-[#8B8AA0]">Silakan login terlebih dahulu.</div>;
  }

  const cookieStore = await cookies();
  const activeBusinessId = cookieStore.get("active_business_id")?.value;

  const { data: businessData } = await supabase
    .from("businesses").select("id, type, name")
    .eq("user_id", user.id).order("created_at", { ascending: true });

  const business = businessData?.find(b => b.id === activeBusinessId) || businessData?.[0] || null;

  if (!business) {
    return (
      <div className="mx-auto max-w-lg px-8 py-12 text-center">
        <h1 className="mb-2 text-xl font-semibold">AI Kasir</h1>
        <p className="text-sm text-[#8B8AA0]">Buat bisnis dulu di Multi Bisnis sebelum menggunakan kasir.</p>
        <a href="/dashboard/multi-bisnis" className="mt-4 inline-block text-sm text-[#2DD4BF]">Kelola bisnis →</a>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  const [{ data: products }, { data: activeShift }, { data: todayTxs }, { data: todayShifts }] = await Promise.all([
    supabase.from("products")
      .select("id, name, price, cost, stock, min_stock, category, sku")
      .eq("business_id", business.id)
      .order("category").order("name"),
    supabase.from("kasir_shifts")
      .select("*")
      .eq("business_id", business.id)
      .eq("user_id", user.id)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("transactions")
      .select("id, amount, description, category, created_at")
      .eq("business_id", business.id)
      .eq("type", "pemasukan")
      .eq("scope", "bisnis")
      .gte("transaction_date", today)
      .order("created_at", { ascending: false }),
    supabase.from("kasir_shifts")
      .select("*")
      .eq("business_id", business.id)
      .gte("opened_at", today + "T00:00:00")
      .order("opened_at", { ascending: false }),
  ]);

  return (
    <AiKasirClient
      userId={user.id}
      businessId={business.id}
      businessName={business.name}
      products={(products || []) as Product[]}
      activeShift={(activeShift || null) as KasirShift | null}
      todayTransactions={(todayTxs || []) as TodayTx[]}
      todayShifts={(todayShifts || []) as KasirShift[]}
      today={today}
    />
  );
}
