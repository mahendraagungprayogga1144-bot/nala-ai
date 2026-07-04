import { createClient } from "@/lib/supabase/server";
import AdminOverviewClient from "./admin-overview-client";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [
    { count: totalUsers },
    { data: subsData },
    { data: paymentsData },
    { data: bizData },
    { data: allUsers },
  ] = await Promise.all([
    supabase.from("businesses").select("user_id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("plan, status, created_at, expired_at"),
    supabase.from("payments").select("amount, status, created_at").eq("status", "paid"),
    supabase.from("businesses").select("id, type, created_at"),
    supabase.from("businesses").select("user_id, created_at").order("created_at", { ascending: true }),
  ]);

  const subs = (subsData || []) as { plan: string; status: string; created_at: string; expired_at: string | null }[];
  const payments = (paymentsData || []) as { amount: number; status: string; created_at: string }[];
  const businesses = (bizData || []) as { id: string; type: string; created_at: string }[];
  const users = (allUsers || []) as { user_id: string; created_at: string }[];

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisYear = now.getFullYear();

  const planCounts: Record<string, number> = { free: 0, starter: 0, pro: 0, enterprise: 0 };
  subs.forEach(s => { planCounts[s.plan] = (planCounts[s.plan] || 0) + 1; });

  const revenueThisMonth = payments
    .filter(p => p.created_at.startsWith(thisMonth))
    .reduce((s, p) => s + Number(p.amount), 0);

  const revenueThisYear = payments
    .filter(p => p.created_at.startsWith(String(thisYear)))
    .reduce((s, p) => s + Number(p.amount), 0);

  const newUsersThisMonth = users.filter(u => u.created_at.startsWith(thisMonth)).length;

  const expiredCount = subs.filter(s => s.expired_at && new Date(s.expired_at) < now && s.status !== "active").length;
  const churnRate = subs.length > 0 ? Math.round((expiredCount / subs.length) * 100) : 0;

  const uniqueUsers = new Set(users.map(u => u.user_id));

  const userGrowth: { month: string; count: number }[] = [];
  const monthSet = new Set<string>();
  users.forEach(u => {
    const m = u.created_at.slice(0, 7);
    monthSet.add(m);
  });
  const sortedMonths = Array.from(monthSet).sort();
  let cumulative = 0;
  const monthCounts: Record<string, number> = {};
  users.forEach(u => { const m = u.created_at.slice(0, 7); monthCounts[m] = (monthCounts[m] || 0) + 1; });
  sortedMonths.forEach(m => {
    cumulative += monthCounts[m] || 0;
    userGrowth.push({ month: m, count: cumulative });
  });

  const revenueByMonth: { month: string; revenue: number }[] = [];
  const revMonths: Record<string, number> = {};
  payments.forEach(p => { const m = p.created_at.slice(0, 7); revMonths[m] = (revMonths[m] || 0) + Number(p.amount); });
  Object.entries(revMonths).sort().forEach(([m, r]) => revenueByMonth.push({ month: m, revenue: r }));

  return (
    <AdminOverviewClient
      totalUsers={uniqueUsers.size}
      newUsersThisMonth={newUsersThisMonth}
      revenueThisMonth={revenueThisMonth}
      revenueThisYear={revenueThisYear}
      churnRate={churnRate}
      planCounts={planCounts}
      userGrowth={userGrowth}
      revenueByMonth={revenueByMonth}
      totalBusinesses={businesses.length}
    />
  );
}
