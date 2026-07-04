import { createClient } from "@/lib/supabase/server";
import AdminStatsClient from "./admin-stats-client";

export default async function AdminStatsPage() {
  const supabase = await createClient();

  const [{ data: businesses }, { data: transactions }, { data: orders }] = await Promise.all([
    supabase.from("businesses").select("id, user_id, type, name, created_at").order("created_at", { ascending: false }),
    supabase.from("transactions").select("user_id, category, created_at").order("created_at", { ascending: false }).limit(5000),
    supabase.from("orders").select("user_id, total, created_at").order("created_at", { ascending: false }).limit(5000),
  ]);

  const biz = (businesses || []) as { id: string; user_id: string; type: string; name: string; created_at: string }[];
  const txs = (transactions || []) as { user_id: string; category: string; created_at: string }[];
  const ords = (orders || []) as { user_id: string; total: number; created_at: string }[];

  const typeBreakdown: Record<string, number> = {};
  biz.forEach(b => { typeBreakdown[b.type || "lainnya"] = (typeBreakdown[b.type || "lainnya"] || 0) + 1; });

  const categoryCount: Record<string, number> = {};
  txs.forEach(t => { categoryCount[t.category || "Lainnya"] = (categoryCount[t.category || "Lainnya"] || 0) + 1; });

  const userActivity: Record<string, number> = {};
  txs.forEach(t => { userActivity[t.user_id] = (userActivity[t.user_id] || 0) + 1; });
  ords.forEach(o => { userActivity[o.user_id] = (userActivity[o.user_id] || 0) + 1; });

  const topUsers = Object.entries(userActivity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([uid, count]) => {
      const b = biz.find(bb => bb.user_id === uid);
      return { user_id: uid, name: b?.name || uid.slice(0, 8), count };
    });

  const topCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <AdminStatsClient
      totalBusinesses={biz.length}
      typeBreakdown={typeBreakdown}
      topUsers={topUsers}
      topCategories={topCategories}
      totalTransactions={txs.length}
      totalOrders={ords.length}
    />
  );
}
