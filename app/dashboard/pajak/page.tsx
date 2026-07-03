import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import PajakClient from "./pajak-client";

export default async function PajakPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { business } = await getActiveBusiness(supabase, user!.id);

  const now = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();
  const startDate = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
  const endDate = new Date(tahun, bulan, 0).toISOString().split("T")[0];

  let omzet = 0;
  let pemasukan = 0;
  let pengeluaran = 0;
  let txCount = 0;

  if (business?.id) {
    const { data: txs } = await supabase
      .from("transactions")
      .select("type, amount")
      .eq("business_id", business.id)
      .eq("scope", "bisnis")
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate);

    txCount = txs?.length || 0;
    txs?.forEach(t => {
      const amt = Number(t.amount || 0);
      if (t.type === "pemasukan") {
        pemasukan += amt;
        omzet += amt;
      } else {
        pengeluaran += amt;
      }
    });

    if (business.type === "kuliner") {
      const { data: orders } = await supabase
        .from("orders")
        .select("total")
        .eq("business_id", business.id)
        .gte("order_date", startDate)
        .lte("order_date", endDate);
      const kasirOmzet = (orders || []).reduce((s, o) => s + Number(o.total || 0), 0);
      if (kasirOmzet > omzet) omzet = kasirOmzet;
    }
  }

  return (
    <PajakClient
      businessName={business?.name || "Bisnis"}
      bulan={bulan}
      tahun={tahun}
      omzet={omzet}
      pemasukan={pemasukan}
      pengeluaran={pengeluaran}
      txCount={txCount}
    />
  );
}
