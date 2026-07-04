import { createClient } from "@/lib/supabase/server";
import AdminUsersClient from "./admin-users-client";

export type AdminUser = {
  user_id: string;
  email: string;
  name: string | null;
  plan: string;
  status: string;
  created_at: string;
  expired_at: string | null;
  trial_ends_at: string | null;
  business_count: number;
};

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("user_id, name, created_at")
    .order("created_at", { ascending: true });

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("user_id, plan, status, expired_at, trial_ends_at, created_at");

  const userMap = new Map<string, AdminUser>();

  (businesses || []).forEach(b => {
    if (!userMap.has(b.user_id)) {
      userMap.set(b.user_id, {
        user_id: b.user_id,
        email: "",
        name: b.name,
        plan: "free",
        status: "active",
        created_at: b.created_at,
        expired_at: null,
        trial_ends_at: null,
        business_count: 1,
      });
    } else {
      userMap.get(b.user_id)!.business_count++;
    }
  });

  (subs || []).forEach(s => {
    const u = userMap.get(s.user_id);
    if (u) {
      u.plan = s.plan;
      u.status = s.status;
      u.expired_at = s.expired_at;
      u.trial_ends_at = s.trial_ends_at;
    }
  });

  const users = Array.from(userMap.values()).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return <AdminUsersClient users={users} />;
}
