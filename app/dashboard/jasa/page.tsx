import { Briefcase } from "lucide-react";
import { getActiveBusiness, WrongBizType } from "../lib/get-active-business";
import BizHubShell, { fmtRp } from "../components/biz-hub-shell";
import JasaClient from "./jasa-client";
import { normalizeBizType } from "@/lib/auth/post-login";
import { guardPage } from "../lib/page-guard";

export default async function JasaPage() {
  return guardPage("Order Jasa", async () => {
  const { supabase, user, business } = await getActiveBusiness("jasa");
  if (!user) return null;
  if (!business || normalizeBizType(business.type) !== "jasa") return <WrongBizType label="Jasa / Freelance" />;

  const { data: jobs } = await supabase
    .from("module_service_jobs")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const aktif = (jobs || []).filter((j) => j.status === "aktif");
  const pipeline = aktif.reduce((s, j) => s + Number(j.fee || 0), 0);
  const selesai = (jobs || []).filter((j) => j.status === "selesai");
  const omzet = selesai.reduce((s, j) => s + Number(j.fee || 0), 0);

  return (
    <BizHubShell
      icon={Briefcase}
      title="Order Jasa"
      subtitle="Catat order klien, fee, status, dan jatuh tempo — tanpa ribet stok barang."
      businessName={business.name}
      kpis={[
        { label: "Order aktif", value: String(aktif.length) },
        { label: "Pipeline fee", value: fmtRp(pipeline), color: "#38BDF8" },
        { label: "Selesai", value: String(selesai.length) },
        { label: "Omzet selesai", value: fmtRp(omzet), color: "#2DD4BF" },
      ]}
    >
      <JasaClient businessId={business.id} userId={user.id} jobs={jobs || []} />
    </BizHubShell>
  );
  });
}
