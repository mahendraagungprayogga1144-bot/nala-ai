import { ShoppingBag } from "lucide-react";
import { getActiveBusiness, WrongBizType } from "../lib/get-active-business";
import BizHubShell, { fmtRp } from "../components/biz-hub-shell";

export default async function OlshopHubPage() {
  const { supabase, business } = await getActiveBusiness("olshop");
  if (!business || business.type !== "olshop") return <WrongBizType label="Online Shop" />;

  const [{ data: products }, { data: stores }, { data: reports }] = await Promise.all([
    supabase.from("products").select("id, stock, min_stock, price").eq("business_id", business.id),
    supabase.from("module_marketplace_stores").select("id").eq("business_id", business.id),
    supabase.from("marketplace_reports").select("id").eq("business_id", business.id).limit(20),
  ]);

  const total = products?.length || 0;
  const kritis = products?.filter((p) => Number(p.stock) <= Number(p.min_stock)).length || 0;
  const nilai = products?.reduce((s, p) => s + Number(p.stock) * Number(p.price || 0), 0) || 0;

  return (
    <BizHubShell
      icon={ShoppingBag}
      title="Pusat Online Shop"
      subtitle="Kelola stok, toko marketplace, dan laporan CSV dalam satu tempat."
      businessName={business.name}
      kpis={[
        { label: "Produk aktif", value: String(total) },
        { label: "Stok kritis", value: String(kritis), color: kritis ? "#F59E0B" : undefined },
        { label: "Nilai stok", value: fmtRp(nilai), color: "#2DD4BF" },
        { label: "Toko terdaftar", value: String(stores?.length || 0) },
      ]}
      links={[
        { href: "/dashboard/inventory", label: "Inventory", desc: "Samakan stok online & offline." },
        { href: "/dashboard/marketplace-center", label: "Marketplace Center", desc: "Daftar toko Shopee/TikTok/Tokopedia." },
        { href: "/dashboard/marketplace", label: "Laporan Marketplace", desc: "Upload CSV order, analisis otomatis." },
        { href: "/dashboard/ai-marketing", label: "AI Marketing", desc: "Draft caption & promo toko online." },
      ]}
    >
      <div className="rounded-2xl border border-[#F43F5E]/20 bg-[#F43F5E]/[0.06] p-4 text-sm text-[#8B8AA0]">
        Tip olshop: daftar toko di Marketplace Center, upload CSV di Laporan Marketplace ({reports?.length || 0} laporan tersimpan),
        dan jaga stok biar tidak oversell.
      </div>
    </BizHubShell>
  );
}
