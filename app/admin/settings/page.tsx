import { getPlatformSettings } from "@/lib/admin/settings";
import AdminSettingsClient from "./admin-settings-client";

export default async function AdminSettingsPage() {
  const settings = await getPlatformSettings({ force: true });
  return <AdminSettingsClient initial={settings} />;
}
