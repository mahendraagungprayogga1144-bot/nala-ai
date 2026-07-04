"use client";
import { usePathname } from "next/navigation";
import BusinessSwitcher from "./business-switcher";
import { getSidebarModules, type DashboardModule } from "./lib/modules-registry";
import { Shield } from "lucide-react";

type Business = { id: string; name: string; type: string | null };

const ADMIN_EMAIL = "mahendraagungprayogga1144@gmail.com";

export default function Sidebar({ expanded, setExpanded, businesses, activeBusiness, userName, userEmail, onNavigate, embedded }: {
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  businesses: Business[];
  activeBusiness: Business | null;
  userName?: string;
  userEmail?: string;
  onNavigate?: () => void;
  embedded?: boolean;
}) {
  const pathname = usePathname();
  const groups = getSidebarModules(activeBusiness?.type);

  const isActive = (m: DashboardModule) =>
    pathname === m.href || (m.href !== "/dashboard/chat" && pathname.startsWith(m.href + "/"));

  const renderItem = (m: DashboardModule) => {
    const active = isActive(m);
    const itemCls = [
      "mb-0.5 flex items-center gap-2.5 rounded-lg transition-all duration-200",
      expanded ? "px-2.5 py-[7px]" : "justify-center p-[7px]",
      active
        ? "border border-[#2DD4BF]/20 bg-gradient-to-r from-[#2DD4BF]/[0.12] to-[#8B5CF6]/[0.08] text-[#2DD4BF]"
        : "border border-transparent text-[#5A5B7A] hover:bg-white/[0.03] hover:text-[#8B8AA0]",
    ].join(" ");

    return (
      <a key={m.href + m.name} href={m.href} onClick={() => onNavigate?.()} title={m.name} className={itemCls}>
        <m.icon size={15} className="flex-shrink-0" />
        {expanded && (
          <>
            <span className="ml-2.5 whitespace-nowrap text-xs font-medium">{m.name}</span>
            {m.status === "beta" && (
              <span className="ml-auto text-[8px] font-medium text-[#F59E0B]">β</span>
            )}
          </>
        )}
      </a>
    );
  };

  return (
    <aside
      className={[
        "flex h-screen flex-col overflow-hidden border-r border-white/[0.06] bg-[#0D0D1A] z-50",
        embedded ? "relative w-full" : "fixed top-0 left-0",
      ].join(" ")}
      style={{
        width: embedded ? "100%" : expanded ? 220 : 64,
        transition: embedded ? undefined : "width 0.22s cubic-bezier(0.4,0,0.2,1)",
      }}
      onMouseEnter={() => !embedded && setExpanded(true)}
      onMouseLeave={() => !embedded && setExpanded(false)}
    >
      <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-10 blur-[60px]"
        style={{ background: "radial-gradient(circle, #2DD4BF, transparent)" }} />

      <div className="flex h-[60px] flex-shrink-0 items-center gap-2.5 border-b border-white/[0.06] px-4">
        <img src="/logo-gercep.png" alt="Gercep AI" className="h-7 w-7 flex-shrink-0 rounded-lg object-cover" />
        {expanded && (
          <span className="whitespace-nowrap text-sm font-bold text-[#F0EFF8]">
            GERCEP <span className="holo-text">AI</span>
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" style={{ scrollbarWidth: "none" }}>
        {groups.map(g => (
          <div key={g.label}>
            {expanded && (
              <p className="mb-1.5 mt-3 px-2 text-[9px] font-semibold tracking-[0.08em] text-[#3A3B52] whitespace-nowrap">
                {g.label}
              </p>
            )}
            {g.modules.map(renderItem)}
          </div>
        ))}
      </nav>

      {expanded && userEmail === ADMIN_EMAIL && (
        <a href="/admin" onClick={() => onNavigate?.()}
          className="mx-2 mb-2 flex items-center gap-2 rounded-xl border border-[#EC4899]/20 bg-gradient-to-r from-[#EC4899]/[0.08] to-[#8B5CF6]/[0.06] px-3 py-2.5 text-xs font-bold text-[#EC4899] transition-all hover:from-[#EC4899]/[0.15]">
          <Shield size={14} />
          Admin Panel
        </a>
      )}

      {expanded && (
        <div className="mx-2 mb-2 rounded-xl border border-[#2DD4BF]/15 bg-gradient-to-br from-[#2DD4BF]/[0.08] to-[#8B5CF6]/[0.06] p-3">
          <p className="mb-0.5 text-xs font-semibold text-[#2DD4BF]">🚀 Upgrade ke Pro</p>
          <p className="mb-2.5 text-[10px] leading-relaxed text-[#5A5B7A]">Akses semua fitur premium tanpa batas</p>
          <a href="/dashboard/upgrade" onClick={() => onNavigate?.()}
            className="gercep-gradient-btn block w-full cursor-pointer rounded-lg py-1.5 text-center text-[11px] font-bold transition-opacity hover:opacity-90">
            Upgrade Sekarang
          </a>
        </div>
      )}

      {expanded && <BusinessSwitcher businesses={businesses} activeBusiness={activeBusiness} />}

      <div className="flex-shrink-0 border-t border-white/[0.06] px-2 py-3">
        {expanded ? (
          <div className="flex items-center gap-2 px-2">
            <div className="gercep-gradient-btn flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
              {userName ? userName[0].toUpperCase() : "M"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#F0EFF8]">{userName || "Owner"}</p>
              <p className="text-[10px] text-[#5A5B7A]">{businesses.length} bisnis</p>
            </div>
            <a href="/login" className="ml-auto text-[10px] text-[#5A5B7A] transition-colors hover:text-[#EC4899]">Keluar</a>
          </div>
        ) : (
          <div className="flex justify-center">
            <a href="/login" title="Keluar" className="text-xs text-[#5A5B7A] transition-colors hover:text-[#EC4899]">↩</a>
          </div>
        )}
      </div>
    </aside>
  );
}
