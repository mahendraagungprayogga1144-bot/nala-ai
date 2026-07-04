import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  last_sign_in: string | null;
};

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: businesses }, { data: subs }, { data: profiles }] = await Promise.all([
    supabase.from("businesses").select("user_id, name, created_at").order("created_at", { ascending: true }),
    supabase.from("subscriptions").select("user_id, plan, status, expired_at, trial_ends_at, created_at"),
    supabase.from("profiles").select("id, full_name"),
  ]);

  let authUsers: { id: string; email?: string; last_sign_in_at?: string | null; created_at: string }[] = [];
  if (admin) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 500 });
    authUsers = (data?.users || []).map(u => ({
      id: u.id, email: u.email, last_sign_in_at: u.last_sign_in_at, created_at: u.created_at,
    }));
  }

  const emailMap = new Map<string, string>();
  const loginMap = new Map<string, string | null>();
  const authCreatedMap = new Map<string, string>();
  authUsers.forEach(u => {
    if (u.email) emailMap.set(u.id, u.email);
    loginMap.set(u.id, u.last_sign_in_at || null);
    authCreatedMap.set(u.id, u.created_at);
  });

  const profileMap = new Map<string, string>();
  (profiles || []).forEach((p: { id: string; full_name: string | null }) => { if (p.full_name) profileMap.set(p.id, p.full_name); });

  const subMap = new Map<string, { plan: string; status: string; expired_at: string | null; trial_ends_at: string | null }>();
  (subs || []).forEach((s: any) => subMap.set(s.user_id, s));

  const userMap = new Map<string, AdminUser>();

  authUsers.forEach(u => {
    const sub = subMap.get(u.id);
    userMap.set(u.id, {
      user_id: u.id,
      email: u.email || "",
      name: profileMap.get(u.id) || null,
      plan: sub?.plan || "free",
      status: sub?.status || "active",
      created_at: u.created_at,
      expired_at: sub?.expired_at || null,
      trial_ends_at: sub?.trial_ends_at || null,
      business_count: 0,
      last_sign_in: u.last_sign_in_at || null,
    });
  });

  (businesses || []).forEach((b: any) => {
    if (userMap.has(b.user_id)) {
      userMap.get(b.user_id)!.business_count++;
    } else {
      const sub = subMap.get(b.user_id);
      userMap.set(b.user_id, {
        user_id: b.user_id,
        email: emailMap.get(b.user_id) || "",
        name: profileMap.get(b.user_id) || b.name,
        plan: sub?.plan || "free",
        status: sub?.status || "active",
        created_at: b.created_at,
        expired_at: sub?.expired_at || null,
        trial_ends_at: sub?.trial_ends_at || null,
        business_count: 1,
        last_sign_in: loginMap.get(b.user_id) || null,
      });
    }
  });

  const users = Array.from(userMap.values()).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return <AdminUsersClient users={users} />;
}
