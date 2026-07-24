"use client";
import { createClient } from "@/lib/supabase/client";
import { trackClientEvent } from "@/lib/admin/track-event";

function clearAppCookies() {
  const expire = "path=/; max-age=0; samesite=lax";
  document.cookie = `ob_done=; ${expire}`;
  document.cookie = `sub_checked=; ${expire}`;
  document.cookie = `sub_expired=; ${expire}`;
  document.cookie = `active_business_id=; ${expire}`;
}

export default function LogoutButton({ className }: { className?: string }) {
  const handleLogout = async () => {
    trackClientEvent({ event: "logout", module: "auth" });
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAppCookies();
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
