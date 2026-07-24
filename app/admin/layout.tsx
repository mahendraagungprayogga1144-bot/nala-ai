import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminSidebar from "./admin-sidebar";
import { getPlatformSettings } from "@/lib/admin/settings";
import { isAdminEmail } from "@/lib/auth/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const settings = await getPlatformSettings();
  if (!user || !isAdminEmail(user.email, settings.admin_emails)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#070711", color: "#F2F1F8" }}>
      <AdminSidebar />
      <main className="ml-0 min-w-0 flex-1 md:ml-[220px]">{children}</main>
    </div>
  );
}
