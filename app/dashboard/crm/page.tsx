import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import { todayWib } from "@/lib/date";
import CrmClient from "./crm-client";

export default async function CrmPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { business } = await getActiveBusiness(supabase, user!.id);
  const today = todayWib();
  const monthStart = today.slice(0, 8) + "01";

  type Row = { id: string; label: string; total: number; count: number; lastAt: string };

  let customers: Row[] = [];

  if (business?.type === "kuliner" && business.id) {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, total, catatan, created_at")
      .eq("business_id", business.id)
      .gte("order_date", monthStart)
      .order("created_at", { ascending: false })
      .limit(200);

    const map: Record<string, Row> = {};
    (orders || []).forEach(o => {
      const label = o.catatan?.match(/^Meja\s+\S+/i)?.[0] || o.catatan || "Walk-in / Takeaway";
      if (!map[label]) map[label] = { id: label, label, total: 0, count: 0, lastAt: o.created_at };
      map[label].total += Number(o.total || 0);
      map[label].count += 1;
      if (o.created_at > map[label].lastAt) map[label].lastAt = o.created_at;
    });
    customers = Object.values(map).sort((a, b) => b.total - a.total);
  } else if (business?.id) {
    const { data: txs } = await supabase
      .from("transactions")
      .select("id, amount, description, created_at")
      .eq("business_id", business.id)
      .eq("scope", "bisnis")
      .eq("type", "pemasukan")
      .gte("transaction_date", monthStart)
      .order("created_at", { ascending: false })
      .limit(100);

    const map: Record<string, Row> = {};
    (txs || []).forEach(t => {
      const label = (t.description || "Pelanggan").split(",")[0].slice(0, 40);
      if (!map[label]) map[label] = { id: label, label, total: 0, count: 0, lastAt: t.created_at };
      map[label].total += Number(t.amount || 0);
      map[label].count += 1;
    });
    customers = Object.values(map).sort((a, b) => b.total - a.total);
  }

  return <CrmClient businessName={business?.name || "Bisnis"} customers={customers} />;
}
