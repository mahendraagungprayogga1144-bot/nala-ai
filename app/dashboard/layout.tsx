import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "./dashboard-shell";
import { cookies } from "next/headers";
import { getDefaultSettings, getPlatformSettings } from "@/lib/admin/settings";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const cookieStore = await cookies();
  let profile: { full_name?: string | null; avatar_url?: string | null } | null = null;
  const [{ data: businesses }, profileRes, settings] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name, type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle(),
    getPlatformSettings().catch(() => getDefaultSettings()),
  ]);
  if (profileRes.error) {
    const basic = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    profile = basic.data;
  } else {
    profile = profileRes.data;
  }

  // Never throw on missing/invalid cookie — fall back to first business.
  const activeId = cookieStore.get("active_business_id")?.value;
  const list = businesses || [];
  const activeBusiness = list.find((b) => b.id === activeId) || list[0] || null;

  const userName = profile?.full_name || user.email?.split("@")[0] || "Owner";
  const userEmail = user.email || "";
  const avatarUrl = profile?.avatar_url || null;

  return (
    <div className="flex min-h-screen w-full min-w-0 overflow-x-hidden bg-[#070711] text-[#F2F1F8]">
      <DashboardShell
        businesses={list}
        activeBusiness={activeBusiness}
        userName={userName}
        userEmail={userEmail}
        avatarUrl={avatarUrl}
        featureFlags={settings.feature_flags}
        announcement={{
          enabled: settings.announcement_enabled,
          message: settings.announcement_message,
          link: settings.announcement_link,
        }}
      >
        {children}
      </DashboardShell>
    </div>
  );
}
