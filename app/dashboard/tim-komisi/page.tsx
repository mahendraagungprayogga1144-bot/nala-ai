import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import { todayWib } from "@/lib/date";
import TimKomisiClient from "./tim-komisi-client";

export default async function TimKomisiPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { business } = await getActiveBusiness(supabase, user!.id);
  const today = todayWib();

  type Row = { id: string; nama: string; orderCount: number; omzet: number };

  let rows: Row[] = [];

  if (business?.type === "kuliner" && business.id) {
    const [{ data: employees }, { data: orders }, { data: profile }] = await Promise.all([
      supabase.from("employees").select("id, nama").eq("business_id", business.id),
      supabase.from("orders").select("user_id, total").eq("business_id", business.id).eq("order_date", today),
      supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle(),
    ]);

    const stats: Record<string, { omzet: number; count: number }> = {};
    (orders || []).forEach(o => {
      if (!stats[o.user_id]) stats[o.user_id] = { omzet: 0, count: 0 };
      stats[o.user_id].omzet += Number(o.total || 0);
      stats[o.user_id].count += 1;
    });

    rows = (employees || []).map(e => ({
      id: e.id,
      nama: e.nama,
      orderCount: stats[e.id]?.count || 0,
      omzet: stats[e.id]?.omzet || 0,
    }));

    if (stats[user!.id]) {
      rows.unshift({
        id: user!.id,
        nama: profile?.full_name || "Owner",
        orderCount: stats[user!.id].count,
        omzet: stats[user!.id].omzet,
      });
    }
    rows.sort((a, b) => b.omzet - a.omzet);
  }

  return (
    <TimKomisiClient
      businessName={business?.name || "Bisnis"}
      businessType={business?.type || null}
      rows={rows}
    />
  );
}
