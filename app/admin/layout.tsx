import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminSidebar from "./admin-sidebar";

const ADMIN_EMAIL = "mahendraagungprayogga1144@gmail.com";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#070711", color: "#F2F1F8" }}>
      <AdminSidebar />
      <main className="flex-1 min-w-0 ml-0 md:ml-[220px]">{children}</main>
    </div>
  );
}
