"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BusinessSwitcher from "./business-switcher";
import { getSidebarModules, type DashboardModule } from "./lib/modules-registry";
import { Shield, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FALLBACK_ADMIN_EMAIL, isAdminEmail } from "@/lib/auth/admin";
import { trackClientEvent } from "@/lib/admin/track-event";
import { clearFastGateCookies } from "@/lib/auth/post-login";

type Business = { id: string; name: string; type: string | null };

export default function Sidebar({
  expanded,
  setExpanded,
  businesses,
  activeBusiness,
  userName,
  userEmail,
  avatarUrl,
  onNavigate,
  embedded,
  featureFlags,
}: {
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  businesses: Business[];
  activeBusiness: Business | null;
  userName?: string;
  userEmail?: string;
  avatarUrl?: string | null;
  onNavigate?: () => void;
  embedded?: boolean;
  featureFlags?: { ai_kasir?: boolean; ai_jual_beli?: boolean; marketplace?: boolean; pajak?: boolean };
}) {
  const pathname = usePathname();
  const groups = getSidebarModules(activeBusiness?.type, featureFlags);

  const handleLogout = async () => {
    trackClientEvent({ event: "logout", module: "auth" });
    const supabase = createClient();
    await supabase.auth.signOut();
    clearFastGateCookies();
    window.location.assign("/login");
  };

  const isActive = (m: DashboardModule) =>
    pathname === m.href || (m.href !== "/dashboard/chat" && pathname.startsWith(m.href + "/"));

  const renderItem = (m: DashboardModule) => {
    const active = isActive(m);
    const itemCls = [
      "group flex items-center gap-3 rounded-xl transition-all duration-200",
      expanded ? (embedded ? "px-3 py-2.5" : "px-2.5 py-2") : "justify-center p-2",
      active
        ? "bg-[#2A2140] text-[#F4F1EA]"
        : "text-[#C8C2B6] hover:bg-[#1A1D24] hover:text-[#F4F1EA]",
    ].join(" ");

    return (
      <Link
        key={m.href + m.name}
        href={m.href}
        prefetch={false}
        onClick={() => onNavigate?.()}
        title={m.name}
        className={itemCls}
      >
        <span
          className={[
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
            active ? "bg-[#5B21B6] text-[#F8F5FF]" : "bg-[#1A1D24] text-[#C8C2B6] group-hover:text-[#F4F1EA]",
          ].join(" ")}
        >
          <m.icon size={15} strokeWidth={1.75} aria-hidden="true" />
        </span>
        {expanded && (
          <>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight">{m.name}</span>
            {m.status === "beta" && (
              <span className="shrink-0 rounded-md border border-[#8A8478] px-1.5 py-0.5 text-[10px] font-medium text-[#C8C2B6]">
                Beta
              </span>
            )}
          </>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={[
        "relative flex min-h-0 flex-col overflow-hidden border-r border-[#8A8478] bg-[#12141A]",
        embedded ? "h-full w-full border-r-0" : "fixed top-0 left-0 z-50 h-screen",
      ].join(" ")}
      style={{
        width: embedded ? "100%" : expanded ? 232 : 64,
        transition: embedded ? undefined : "width 0.22s cubic-bezier(0.4,0,0.2,1)",
      }}
      onMouseEnter={() => !embedded && setExpanded(true)}
      onMouseLeave={() => !embedded && setExpanded(false)}
    >
      {!embedded && (
        <div className="flex h-[60px] flex-shrink-0 items-center gap-2.5 border-b border-[#8A8478] px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-gercep.png" alt="" width={28} height={28} className="h-7 w-7 flex-shrink-0 rounded-md object-cover" />
          {expanded && (
            <span className="whitespace-nowrap text-sm font-semibold text-[#F4F1EA]">
              Gercep AI
            </span>
          )}
        </div>
      )}

      {embedded ? (
        <div className="shrink-0 border-b border-[#8A8478] px-4 pb-2.5 pt-3">
          {activeBusiness?.name ? (
            <p className="truncate text-sm font-semibold text-[#F4F1EA]">{activeBusiness.name}</p>
          ) : (
            <p className="text-sm text-[#C8C2B6]">Menu</p>
          )}
        </div>
      ) : null}

      <nav
        className={[
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5",
          embedded ? "py-2.5 pb-3" : "py-3",
        ].join(" ")}
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}
      >
        {groups.map((g, gi) => (
          <div key={g.label} className={gi === 0 ? "" : "mt-4"}>
            {expanded && (
              <p className="mb-1.5 px-2.5 text-[11px] font-medium text-[#A39E93]">
                {g.label}
              </p>
            )}
            <div className="space-y-0.5">{g.modules.map(renderItem)}</div>
          </div>
        ))}
      </nav>

      <div
        className={[
          "shrink-0 space-y-2 border-t border-[#8A8478] bg-[#12141A] px-2.5 pt-2.5",
          embedded ? "pb-3" : "pb-3",
        ].join(" ")}
      >
        {expanded && isAdminEmail(userEmail, [FALLBACK_ADMIN_EMAIL]) && (
          <Link
            href="/admin"
            prefetch={false}
            onClick={() => onNavigate?.()}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-[#8A8478] px-3 py-2 text-xs font-semibold text-[#F4F1EA] hover:bg-[#1A1D24]"
          >
            <Shield size={14} aria-hidden="true" />
            Admin Panel
          </Link>
        )}

        {expanded && (
          <Link
            href="/dashboard/upgrade"
            prefetch={false}
            onClick={() => onNavigate?.()}
            className="flex min-h-11 items-center rounded-lg border border-[#8A8478] px-3 py-2 hover:bg-[#1A1D24]"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-[#F4F1EA]">Lihat paket Pro</span>
              <span className="block text-[11px] text-[#C8C2B6]">Kasir, marketplace, pajak</span>
            </span>
          </Link>
        )}

        {expanded && <BusinessSwitcher businesses={businesses} activeBusiness={activeBusiness} />}

        <div className={expanded ? "flex items-center gap-2.5 rounded-lg bg-[#1A1D24] px-2.5 py-2" : "flex justify-center py-1"}>
          {expanded ? (
            <>
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#5B21B6] text-xs font-semibold text-[#F8F5FF]">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" width={32} height={32} className="h-full w-full object-cover" />
                ) : (
                  userName ? userName[0].toUpperCase() : "M"
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-[#F4F1EA]">{userName || "Owner"}</p>
                <p className="text-[11px] text-[#C8C2B6]">
                  {businesses.length} bisnis
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Keluar"
                aria-label="Keluar"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#C8C2B6] hover:bg-[#2A2140] hover:text-[#F4F1EA]"
              >
                <LogOut size={14} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              title="Keluar"
              aria-label="Keluar"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#C8C2B6] hover:text-[#F4F1EA]"
            >
              <LogOut size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
