import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "./dashboard-shell";
import { cookies } from "next/headers";
import { getPlatformSettings } from "@/lib/admin/settings";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const [{ data: businesses }, { data: profile }, settings] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name, type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    getPlatformSettings(),
  ]);

  const activeId = cookieStore.get("active_business_id")?.value;
  const activeBusiness = businesses?.find((b) => b.id === activeId) || businesses?.[0] || null;

  const userName = profile?.full_name || user.email?.split("@")[0] || "Owner";
  const userEmail = user.email || "";

  return (
    <div className="flex min-h-screen w-full min-w-0 overflow-x-hidden bg-[#070711] text-[#F2F1F8]">
      <DashboardShell
        businesses={businesses || []}
        activeBusiness={activeBusiness}
        userName={userName}
        userEmail={userEmail}
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
