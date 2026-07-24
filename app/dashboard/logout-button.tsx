"use client";
import { createClient } from "@/lib/supabase/client";
import { trackClientEvent } from "@/lib/admin/track-event";
import { clearFastGateCookies } from "@/lib/auth/post-login";

export default function LogoutButton({ className }: { className?: string }) {
  const handleLogout = async () => {
    trackClientEvent({ event: "logout", module: "auth" });
    const supabase = createClient();
    await supabase.auth.signOut();
    clearFastGateCookies();
    window.location.assign("/login");
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={className || "text-sm px-4 py-2 rounded-lg border border-white/10 text-[#8B8AA0]"}
    >
      Keluar
    </button>
  );
}
