"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  Activity,
  HeartPulse,
  Building2,
  ScrollText,
} from "lucide-react";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/businesses", label: "Bisnis", icon: Building2 },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/stats", label: "Statistik", icon: BarChart3 },
  { href: "/admin/health", label: "Health", icon: HeartPulse },
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed top-0 left-0 z-50 hidden h-screen w-[220px] flex-col border-r border-white/[0.06] md:flex"
      style={{ background: "#0D0D1A" }}
    >
      <div className="flex h-[60px] items-center gap-2.5 border-b border-white/[0.06] px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-gercep.png" alt="Gercep AI" className="h-7 w-7 rounded-lg object-cover" />
        <span className="text-sm font-bold text-[#F0EFF8]">Admin Panel</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" style={{ scrollbarWidth: "none" }}>
        <p className="mt-1 mb-1.5 px-2 text-[9px] font-semibold tracking-[0.08em] text-[#3A3B52] uppercase">
          MENU
        </p>
        {LINKS.map((l) => {
          const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={
                "mb-0.5 flex items-center gap-2.5 rounded-lg border px-2.5 py-[7px] text-xs font-medium transition-all " +
                (active
                  ? "border-[#EC4899]/20 bg-gradient-to-r from-[#EC4899]/[0.12] to-[#8B5CF6]/[0.08] text-[#EC4899]"
                  : "border-transparent text-[#5A5B7A] hover:bg-white/[0.03] hover:text-[#8B8AA0]")
              }
            >
              <l.icon size={15} />
              <span className="ml-2.5">{l.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] px-4 py-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xs text-[#5A5B7A] transition-colors hover:text-[#8B8AA0]"
        >
          ← Kembali ke Dashboard
        </Link>
      </div>
    </aside>
  );
}
