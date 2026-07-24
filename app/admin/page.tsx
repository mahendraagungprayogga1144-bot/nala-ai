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

  // Event-based DAU / WAU / MAU / funnel / top modules
  let dau = activeToday;
  let wau = 0;
  let mau = 0;
  let funnel = { signup: 0, business: 0, first_action: 0 };
  let topModules: { module: string; count: number }[] = [];
  let stalePendingCount = 0;
  if (admin) {
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const cutoff6h = new Date(Date.now() - 6 * 3600_000).toISOString();
    const [{ data: dayEvents }, { data: weekEvents }, { data: monthEvents }, { data: funnelEvents }, { count: staleCount }] =
      await Promise.all([
        admin.from("app_events").select("user_id, module").gte("created_at", dayAgo).limit(5000),
        admin.from("app_events").select("user_id").gte("created_at", weekAgo).limit(8000),
        admin.from("app_events").select("user_id").gte("created_at", monthAgo).limit(10000),
        admin
          .from("app_events")
          .select("user_id, event")
          .in("event", [
            "signup",
            "business_created",
            "onboarding_complete",
            "inventory_sell",
            "ai_kasir_sale",
            "payment_submit",
          ])
          .limit(8000),
        admin
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .lt("created_at", cutoff6h),
      ]);
    stalePendingCount = staleCount || 0;

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
    wau = new Set((weekEvents || []).map((e: { user_id: string | null }) => e.user_id).filter(Boolean)).size;
    mau = new Set((monthEvents || []).map((e: { user_id: string | null }) => e.user_id).filter(Boolean)).size;

    const signupUsers = new Set<string>();
    const bizUsers = new Set<string>();
    const actionUsers = new Set<string>();
    const firstActions = new Set([
      "inventory_sell",
      "ai_kasir_sale",
      "payment_submit",
      "onboarding_complete",
    ]);
    (funnelEvents || []).forEach((e: { user_id: string | null; event: string }) => {
      if (!e.user_id) return;
      if (e.event === "signup") signupUsers.add(e.user_id);
      if (e.event === "business_created" || e.event === "onboarding_complete") bizUsers.add(e.user_id);
      if (firstActions.has(e.event)) actionUsers.add(e.user_id);
    });
    funnel = {
      signup: signupUsers.size || authUsers.length,
      business: bizUsers.size || uniqueUsers.size,
      first_action: actionUsers.size,
    };
  }

  const trialActive = subs.filter(
    (s) =>
      (s.plan === "trial" || s.status === "trial") &&
      s.expired_at &&
      new Date(s.expired_at) > now,
  ).length;

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
      wau={wau}
      mau={mau}
      trialActive={trialActive}
      funnel={funnel}
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
      stalePendingCount={stalePendingCount}
    />
  );
}
