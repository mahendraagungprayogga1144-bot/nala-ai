import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminOverviewClient from "./admin-overview-client";

export type RecentUser = {
  id: string;
  email: string;
  name: string | null;
  last_sign_in: string | null;
  created_at: string;
  plan: string;
};

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const [
    { count: totalUsers },
    { data: subsData },
    { data: paymentsData },
    { data: bizData },
    { data: allUsers },
    { data: profiles },
  ] = await Promise.all([
    supabase.from("businesses").select("user_id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("plan, status, created_at, expired_at"),
    supabase.from("payments").select("amount, status, created_at").eq("status", "paid"),
    supabase.from("businesses").select("id, type, created_at"),
    supabase.from("businesses").select("user_id, created_at").order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, full_name"),
  ]);

  let authUsers: { id: string; email?: string; last_sign_in_at?: string | null; created_at: string }[] = [];
  if (admin) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 500 });
    authUsers = (data?.users || []).map(u => ({
      id: u.id, email: u.email, last_sign_in_at: u.last_sign_in_at, created_at: u.created_at,
    }));
  }

  const subs = (subsData || []) as { plan: string; status: string; created_at: string; expired_at: string | null }[];
  const payments = (paymentsData || []) as { amount: number; status: string; created_at: string }[];
  const businesses = (bizData || []) as { id: string; type: string; created_at: string }[];
  const users = (allUsers || []) as { user_id: string; created_at: string }[];
  const profileMap = new Map<string, string>();
  (profiles || []).forEach((p: { id: string; full_name: string | null }) => { if (p.full_name) profileMap.set(p.id, p.full_name); });

  const subMap = new Map<string, string>();
  subs.forEach(s => { subMap.set((s as any).user_id, s.plan); });

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

  const newUsersThisMonth = authUsers.filter(u => u.created_at.startsWith(thisMonth)).length;

  const expiredCount = subs.filter(s => s.expired_at && new Date(s.expired_at) < now && s.status !== "active").length;
  const churnRate = subs.length > 0 ? Math.round((expiredCount / subs.length) * 100) : 0;

  const activeToday = authUsers.filter(u => {
    if (!u.last_sign_in_at) return false;
    const diff = now.getTime() - new Date(u.last_sign_in_at).getTime();
    return diff < 86_400_000;
  }).length;

  const uniqueUsers = new Set(users.map(u => u.user_id));

  // Event-based DAU / top modules (if table exists)
  let dau = activeToday;
  let topModules: { module: string; count: number }[] = [];
  if (admin) {
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: dayEvents } = await admin
      .from("app_events")
      .select("user_id, module")
      .gte("created_at", dayAgo)
      .limit(5000);
    if (dayEvents?.length) {
      dau = new Set(dayEvents.map((e: { user_id: string | null }) => e.user_id).filter(Boolean)).size;
      const modCount: Record<string, number> = {};
      dayEvents.forEach((e: { module: string | null }) => {
        if (e.module) modCount[e.module] = (modCount[e.module] || 0) + 1;
      });
      topModules = Object.entries(modCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([module, count]) => ({ module, count }));
    }
    void weekAgo;
  }

  const userGrowth: { month: string; count: number }[] = [];
  const monthSet = new Set<string>();
  const allSignups = authUsers.length > 0 ? authUsers : users.map(u => ({ id: u.user_id, created_at: u.created_at }));
  allSignups.forEach(u => { monthSet.add(u.created_at.slice(0, 7)); });
  const sortedMonths = Array.from(monthSet).sort();
  let cumulative = 0;
  const monthCounts: Record<string, number> = {};
  allSignups.forEach(u => { const m = u.created_at.slice(0, 7); monthCounts[m] = (monthCounts[m] || 0) + 1; });
  sortedMonths.forEach(m => {
    cumulative += monthCounts[m] || 0;
    userGrowth.push({ month: m, count: cumulative });
  });

  const revenueByMonth: { month: string; revenue: number }[] = [];
  const revMonths: Record<string, number> = {};
  payments.forEach(p => { const m = p.created_at.slice(0, 7); revMonths[m] = (revMonths[m] || 0) + Number(p.amount); });
  Object.entries(revMonths).sort().forEach(([m, r]) => revenueByMonth.push({ month: m, revenue: r }));

  const recentUsers: RecentUser[] = authUsers
    .filter(u => u.last_sign_in_at)
    .sort((a, b) => new Date(b.last_sign_in_at!).getTime() - new Date(a.last_sign_in_at!).getTime())
    .slice(0, 20)
    .map(u => ({
      id: u.id,
      email: u.email || "—",
      name: profileMap.get(u.id) || null,
      last_sign_in: u.last_sign_in_at || null,
      created_at: u.created_at,
      plan: subMap.get(u.id) || "free",
    }));

  return (
    <AdminOverviewClient
      totalUsers={authUsers.length || uniqueUsers.size}
      activeToday={dau}
      newUsersThisMonth={newUsersThisMonth}
      revenueThisMonth={revenueThisMonth}
      revenueThisYear={revenueThisYear}
      churnRate={churnRate}
      planCounts={planCounts}
      userGrowth={userGrowth}
      revenueByMonth={revenueByMonth}
      totalBusinesses={businesses.length}
      recentUsers={recentUsers}
      topModules={topModules}
    />
  );
}
