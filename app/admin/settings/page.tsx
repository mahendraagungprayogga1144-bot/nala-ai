import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings, isOwnerAdmin } from "@/lib/admin/settings";
import AdminSettingsClient from "./admin-settings-client";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const settings = await getPlatformSettings({ force: true });
  if (!user?.email || !isOwnerAdmin(user.email, settings)) {
    redirect("/admin");
  }
  return <AdminSettingsClient initial={settings} />;
}
