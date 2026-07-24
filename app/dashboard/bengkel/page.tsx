import { Wrench } from "lucide-react";
import { getActiveBusiness, WrongBizType } from "../lib/get-active-business";
import BizHubShell, { fmtRp } from "../components/biz-hub-shell";
import BengkelClient from "./bengkel-client";

export default async function BengkelPage() {
  const { supabase, user, business } = await getActiveBusiness("bengkel");
  if (!user) return null;
  if (!business || business.type !== "bengkel") return <WrongBizType label="Bengkel" />;

  const { data: orders } = await supabase
    .from("module_workshop_orders")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const antrian = (orders || []).filter((o) => o.status === "antrian");
  const proses = (orders || []).filter((o) => o.status === "proses");
  const selesai = (orders || []).filter((o) => o.status === "selesai");
  const omzet = selesai.reduce((s, o) => s + Number(o.biaya_jasa || 0), 0);

  return (
    <BizHubShell
      icon={Wrench}
      title="Antrian Bengkel"
      subtitle="Catat kendaraan, keluhan, spare part, dan status perbaikan."
      businessName={business.name}
      kpis={[
        { label: "Antrian", value: String(antrian.length), color: "#F59E0B" },
        { label: "Sedang dikerjakan", value: String(proses.length), color: "#38BDF8" },
        { label: "Selesai", value: String(selesai.length) },
        { label: "Omzet jasa", value: fmtRp(omzet), color: "#2DD4BF" },
      ]}
      links={[
        { href: "/dashboard/inventory", label: "Spare Part", desc: "Stok oli, ban, filter, dll." },
        { href: "/dashboard/keuangan-bisnis", label: "Keuangan Bisnis", desc: "Omzet jasa & spare part." },
        { href: "/dashboard/crm-pelanggan", label: "CRM", desc: "Riwayat pelanggan bengkel." },
      ]}
    >
      <BengkelClient businessId={business.id} userId={user.id} orders={orders || []} />
    </BizHubShell>
  );
}
