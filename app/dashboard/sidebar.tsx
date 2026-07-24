"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BusinessSwitcher from "./business-switcher";
import { getSidebarModules, type DashboardModule } from "./lib/modules-registry";
import { Shield, Sparkles, LogOut } from "lucide-react";
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
        ? "bg-[#2DD4BF]/[0.12] text-[#E8FFFB] shadow-[inset_0_0_0_1px_rgba(45,212,191,0.22)]"
        : "text-[#9B9AB5] hover:bg-white/[0.04] hover:text-[#E4E3F0]",
    ].join(" ");

    return (
      <Link
        key={m.href + m.name}
        href={m.href}
        prefetch
        onClick={() => onNavigate?.()}
        title={m.name}
        className={itemCls}
      >
        <span
          className={[
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
            active ? "bg-[#2DD4BF]/20 text-[#2DD4BF]" : "bg-white/[0.04] text-[#7A7998] group-hover:text-[#A8A7C0]",
          ].join(" ")}
        >
          <m.icon size={15} strokeWidth={1.75} />
        </span>
        {expanded && (
          <>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight">{m.name}</span>
            {m.status === "beta" && (
              <span className="shrink-0 rounded-md bg-[#F59E0B]/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-[#F59E0B]/90">
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
        "relative z-50 flex flex-col overflow-hidden border-r border-white/[0.06] bg-[#0B0B16]",
        embedded ? "h-full w-full border-r-0" : "fixed top-0 left-0 h-screen",
      ].join(" ")}
      style={{
        width: embedded ? "100%" : expanded ? 232 : 64,
        transition: embedded ? undefined : "width 0.22s cubic-bezier(0.4,0,0.2,1)",
      }}
      onMouseEnter={() => !embedded && setExpanded(true)}
      onMouseLeave={() => !embedded && setExpanded(false)}
    >
      <div
        className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full opacity-[0.12] blur-[70px]"
        style={{ background: "radial-gradient(circle, #2DD4BF, transparent 70%)" }}
      />

      {/* Logo — desktop only (mobile top bar already shows brand) */}
      {!embedded && (
        <div className="flex h-[60px] flex-shrink-0 items-center gap-2.5 border-b border-white/[0.06] px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-gercep.png" alt="Gercep AI" className="h-7 w-7 flex-shrink-0 rounded-lg object-cover" />
          {expanded && (
            <span className="whitespace-nowrap text-sm font-bold tracking-tight text-[#F0EFF8]">
              GERCEP <span className="holo-text">AI</span>
            </span>
          )}
        </div>
      )}

      {embedded && (
        <div className="flex-shrink-0 px-4 pb-2 pt-3">
          <p className="text-[11px] font-medium tracking-[0.14em] text-[#5A5B7A] uppercase">Navigasi</p>
          {activeBusiness?.name ? (
            <p className="mt-1 truncate text-sm font-semibold text-[#F0EFF8]">{activeBusiness.name}</p>
          ) : null}
        </div>
      )}

      <nav
        className={[
          "flex-1 overflow-y-auto overscroll-contain px-2.5",
          embedded ? "pb-3" : "py-3",
        ].join(" ")}
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}
      >
        {groups.map((g, gi) => (
          <div key={g.label} className={gi === 0 ? "" : "mt-4"}>
            {expanded && (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold tracking-[0.12em] text-[#4A4B66] uppercase">
                {g.label}
              </p>
            )}
            <div className="space-y-0.5">{g.modules.map(renderItem)}</div>
          </div>
        ))}
      </nav>

      <div
        className={[
          "flex-shrink-0 space-y-2 border-t border-white/[0.06] bg-[#0B0B16]/95 px-2.5 pt-2.5 backdrop-blur-sm",
          embedded ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]" : "pb-3",
        ].join(" ")}
      >
        {expanded && isAdminEmail(userEmail, [FALLBACK_ADMIN_EMAIL]) && (
          <Link
            href="/admin"
            prefetch
            onClick={() => onNavigate?.()}
            className="flex items-center gap-2 rounded-xl border border-[#EC4899]/20 bg-[#EC4899]/[0.06] px-3 py-2 text-xs font-semibold text-[#EC4899] transition-colors hover:bg-[#EC4899]/10"
          >
            <Shield size={14} />
            Admin Panel
          </Link>
        )}

        {expanded && (
          <Link
            href="/dashboard/upgrade"
            prefetch
            onClick={() => onNavigate?.()}
            className="flex items-center gap-2.5 rounded-xl border border-[#8B5CF6]/25 bg-gradient-to-r from-[#8B5CF6]/15 to-[#2DD4BF]/10 px-3 py-2.5 transition-opacity hover:opacity-95"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8B5CF6]/25 text-[#C4B5FD]">
              <Sparkles size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold text-[#F0EFF8]">Upgrade Pro</span>
              <span className="block text-[10px] text-[#8B8AA0]">Semua fitur premium</span>
            </span>
          </Link>
        )}

        {expanded && <BusinessSwitcher businesses={businesses} activeBusiness={activeBusiness} />}

        <div className={expanded ? "flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-2.5 py-2" : "flex justify-center py-1"}>
          {expanded ? (
            <>
              <div className="gercep-gradient-btn flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {userName ? userName[0].toUpperCase() : "M"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-[#F0EFF8]">{userName || "Owner"}</p>
                <p className="text-[10px] text-[#5A5B7A]">
                  {businesses.length} bisnis
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Keluar"
                className="rounded-lg p-1.5 text-[#5A5B7A] transition-colors hover:bg-white/[0.05] hover:text-[#EC4899]"
              >
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              title="Keluar"
              className="rounded-lg p-2 text-[#5A5B7A] transition-colors hover:text-[#EC4899]"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
