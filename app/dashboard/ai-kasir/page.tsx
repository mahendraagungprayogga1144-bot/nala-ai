import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import AiKasirClient from "./ai-kasir-client";
import { guardPage } from "../lib/page-guard";
import {
  normalizeReceiptStyle,
  receiptStyleFromBizType,
  type ReceiptStyle,
} from "@/lib/pos/receipt-style";

export type Product = {
  id: string; name: string; price: number; cost: number;
  stock: number; min_stock: number; category: string | null;
  sku: string | null; barcode?: string | null;
};

export type KasirShift = {
  id: string; modal_awal: number; total_transaksi: number;
  total_order: number; kas_akhir: number;
  opened_at: string; closed_at: string | null; status: string;
  staff_id?: string | null; staff_name?: string | null;
};

export type TodaySale = {
  id: string; total: number; diskon: number | null; catatan: string | null;
  metode_bayar: string | null; created_at: string; status?: string | null;
};

export type RetailStaff = {
  id: string; nama: string; pin: string; aktif: boolean;
};

export type AiKasirSettings = {
  storeName: string;
  receiptStyle: ReceiptStyle;
  receiptAddress: string;
  receiptNote: string;
};

export default async function AiKasirPage() {
  return guardPage("AI Kasir", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div className="px-8 py-12 text-center text-[#5C6B63]">Silakan login terlebih dahulu.</div>;
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
        <p className="text-sm text-[#5C6B63]">Buat bisnis dulu di Multi Bisnis sebelum menggunakan kasir.</p>
        <a href="/dashboard/multi-bisnis" className="mt-4 inline-block text-sm text-[#007A4D]">Kelola bisnis →</a>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  const [
    productsRes,
    activeShiftRes,
    todaySalesRes,
    todayShiftsRes,
    settingsRes,
    staffRes,
  ] = await Promise.all([
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
    supabase.from("orders")
      .select("id, total, diskon, catatan, metode_bayar, created_at, status")
      .eq("business_id", business.id)
      .eq("order_date", today)
      .eq("source", "retail_kasir")
      .order("created_at", { ascending: false }),
    supabase.from("kasir_shifts")
      .select("*")
      .eq("business_id", business.id)
      .gte("opened_at", today + "T00:00:00")
      .order("opened_at", { ascending: false }),
    supabase.from("retail_kasir_settings")
      .select("store_name, receipt_style, receipt_note, receipt_address")
      .eq("business_id", business.id)
      .maybeSingle(),
    supabase.from("retail_kasir_staff")
      .select("id, nama, pin, aktif")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true }),
  ]);

  // Fallback if source column belum ada: filter catatan AI Kasir
  let todaySales = (todaySalesRes.data || []) as TodaySale[];
  if (todaySalesRes.error) {
    const { data: fallback } = await supabase
      .from("orders")
      .select("id, total, diskon, catatan, metode_bayar, created_at, status")
      .eq("business_id", business.id)
      .eq("order_date", today)
      .ilike("catatan", "%AI Kasir%")
      .order("created_at", { ascending: false });
    todaySales = (fallback || []) as TodaySale[];
  }

  // Settings fallback jika kolom receipt_* belum dimigrasi
  let kasirSettings: AiKasirSettings = {
    storeName: "",
    receiptStyle: receiptStyleFromBizType(business.type),
    receiptAddress: "",
    receiptNote: "",
  };
  if (!settingsRes.error && settingsRes.data) {
    kasirSettings = {
      storeName: settingsRes.data.store_name || "",
      receiptStyle: settingsRes.data.receipt_style
        ? normalizeReceiptStyle(settingsRes.data.receipt_style)
        : receiptStyleFromBizType(business.type),
      receiptAddress: settingsRes.data.receipt_address || "",
      receiptNote: settingsRes.data.receipt_note || "",
    };
  } else if (settingsRes.error) {
    const { data: legacy } = await supabase
      .from("retail_kasir_settings")
      .select("store_name")
      .eq("business_id", business.id)
      .maybeSingle();
    kasirSettings = {
      storeName: legacy?.store_name || "",
      receiptStyle: receiptStyleFromBizType(business.type),
      receiptAddress: "",
      receiptNote: "",
    };
  }

  return (
    <AiKasirClient
      userId={user.id}
      businessId={business.id}
      businessName={business.name}
      settings={kasirSettings}
      products={(productsRes.data || []) as Product[]}
      activeShift={(activeShiftRes.data || null) as KasirShift | null}
      todaySales={todaySales}
      todayShifts={(todayShiftsRes.data || []) as KasirShift[]}
      staff={(staffRes.error ? [] : staffRes.data || []) as RetailStaff[]}
      today={today}
    />
  );
  });
}
