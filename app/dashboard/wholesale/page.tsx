import { Boxes } from "lucide-react";
import { getActiveBusiness, WrongBizType } from "../lib/get-active-business";
import BizHubShell, { fmtRp } from "../components/biz-hub-shell";
import WholesaleClient from "./wholesale-client";

export default async function WholesalePage() {
  const { supabase, user, business } = await getActiveBusiness("wholesale");
  if (!user) return null;
  if (!business || business.type !== "wholesale") return <WrongBizType label="Grosir / Distributor" />;

  const [{ data: products }, { data: attrs }] = await Promise.all([
    supabase.from("products").select("id, name, stock, min_stock, price, unit").eq("business_id", business.id).order("name"),
    supabase.from("module_product_attrs").select("*").eq("business_id", business.id),
  ]);

  const attrMap = Object.fromEntries((attrs || []).map((a) => [a.product_id, a]));
  const rows = (products || []).map((p) => ({
    ...p,
    min_order_qty: attrMap[p.id]?.min_order_qty ?? null,
    wholesale_price: attrMap[p.id]?.wholesale_price ?? null,
    attr_id: attrMap[p.id]?.id ?? null,
  }));

  const underMin = rows.filter((r) => r.min_order_qty && Number(r.stock) < Number(r.min_order_qty)).length;
  const withPrice = rows.filter((r) => r.wholesale_price).length;
  const nilai = rows.reduce((s, r) => s + Number(r.stock) * Number(r.wholesale_price || r.price || 0), 0);

  return (
    <BizHubShell
      icon={Boxes}
      title="Pusat Grosir"
      subtitle="Set harga grosir & minimal order per produk. Cocok untuk distributor."
      businessName={business.name}
      kpis={[
        { label: "SKU", value: String(rows.length) },
        { label: "Punya harga grosir", value: String(withPrice), color: "#2DD4BF" },
        { label: "Di bawah MOQ", value: String(underMin), color: underMin ? "#F59E0B" : undefined },
        { label: "Nilai stok", value: fmtRp(nilai) },
      ]}
      links={[
        { href: "/dashboard/inventory", label: "Inventory", desc: "Tambah / update stok produk." },
        { href: "/dashboard/ai-kasir", label: "Kasir Grosir", desc: "Jual dengan qty besar." },
        { href: "/dashboard/crm-pelanggan", label: "CRM Pelanggan", desc: "Catat buyer toko / outlet." },
      ]}
    >
      <WholesaleClient businessId={business.id} userId={user.id} rows={rows} />
    </BizHubShell>
  );
}
