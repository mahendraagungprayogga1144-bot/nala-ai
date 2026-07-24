import { HeartPulse } from "lucide-react";
import { getActiveBusiness, WrongBizType } from "../lib/get-active-business";
import BizHubShell, { fmtRp } from "../components/biz-hub-shell";
import KesehatanClient from "./kesehatan-client";

function daysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

export default async function KesehatanPage() {
  const { supabase, user, business } = await getActiveBusiness("kesehatan");
  if (!user) return null;
  if (!business || business.type !== "kesehatan") return <WrongBizType label="Kesehatan / Apotek" />;

  const [{ data: products }, { data: attrs }] = await Promise.all([
    supabase.from("products").select("id, name, stock, min_stock, price, unit").eq("business_id", business.id).order("name"),
    supabase.from("module_product_attrs").select("*").eq("business_id", business.id),
  ]);

  const attrMap = Object.fromEntries((attrs || []).map((a) => [a.product_id, a]));
  const rows = (products || []).map((p) => {
    const exp = attrMap[p.id]?.expiry_date ?? null;
    return {
      ...p,
      expiry_date: exp,
      days_left: daysUntil(exp),
      attr_id: attrMap[p.id]?.id ?? null,
    };
  });

  const expired = rows.filter((r) => r.days_left != null && r.days_left < 0).length;
  const soon = rows.filter((r) => r.days_left != null && r.days_left >= 0 && r.days_left <= 30).length;
  const nilai = rows.reduce((s, r) => s + Number(r.stock) * Number(r.price || 0), 0);

  return (
    <BizHubShell
      icon={HeartPulse}
      title="Pusat Kesehatan"
      subtitle="Pantau kadaluarsa obat/produk dan stok kritis — biar aman & patuh."
      businessName={business.name}
      kpis={[
        { label: "Produk", value: String(rows.length) },
        { label: "Kadaluarsa", value: String(expired), color: expired ? "#EC4899" : undefined },
        { label: "≤30 hari", value: String(soon), color: soon ? "#F59E0B" : undefined },
        { label: "Nilai stok", value: fmtRp(nilai), color: "#2DD4BF" },
      ]}
      links={[
        { href: "/dashboard/inventory", label: "Inventory", desc: "Kelola stok obat & alkes." },
        { href: "/dashboard/ai-kasir", label: "Kasir", desc: "Jual cepat dengan barcode." },
        { href: "/dashboard/crm-pelanggan", label: "CRM", desc: "Catat pasien / pelanggan rutin." },
      ]}
    >
      <KesehatanClient businessId={business.id} userId={user.id} rows={rows} />
    </BizHubShell>
  );
}
