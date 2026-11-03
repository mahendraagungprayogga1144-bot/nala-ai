"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clearFastGateCookies } from "@/lib/auth/post-login";
import type { AdminRole } from "@/lib/admin/settings";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/businesses", label: "Bisnis", icon: Building2 },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/stats", label: "Statistik", icon: BarChart3 },
  { href: "/admin/health", label: "Health", icon: HeartPulse },
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings, ownerOnly: true },
];

async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  clearFastGateCookies();
  window.location.assign("/login");
}

export default function AdminSidebar({ role = "owner" }: { role?: AdminRole }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = LINKS.filter((l) => !l.ownerOnly || role === "owner");

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        <p className="mt-1 mb-1.5 px-2 text-[9px] font-semibold tracking-[0.08em] text-[#3A3B52] uppercase">MENU</p>
        {links.map((l) => {
          const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={onNavigate}
              className={
                "mb-0.5 flex items-center gap-2.5 rounded-lg border px-2.5 py-[7px] text-xs font-medium transition-all " +
                (active
                  ? "border-[#EC4899]/20 bg-gradient-to-r from-[#EC4899]/[0.12] to-[#8B5CF6]/[0.08] text-[#EC4899]"
                  : "border-transparent text-[#5A5B7A] hover:bg-white/[0.03] hover:text-[#8B8AA0]")
              }
            >
              <l.icon size={15} />
              <span>{l.label}</span>
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <>
      {/* Mobile top bar */}
      <div
        className="fixed top-0 right-0 left-0 z-[70] flex items-center justify-between border-b border-white/[0.06] bg-[#0D0D1A]/95 px-4 backdrop-blur md:hidden"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          height: "calc(3.5rem + env(safe-area-inset-top))",
        }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-gercep.png" alt="" className="h-7 w-7 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#F0EFF8]">Admin Panel</p>
            <p className="truncate text-[10px] uppercase tracking-wide text-[#5A5B7A]">{role}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-xl border border-[#EC4899]/25 bg-[#EC4899]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#EC4899]"
          >
            Keluar
          </button>
          <button
            type="button"
            aria-label={open ? "Tutup menu" : "Buka menu"}
            onClick={() => setOpen((v) => !v)}
            className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-[65] md:hidden">
          <button type="button" aria-label="Tutup menu" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div
            className="absolute bottom-0 left-0 top-[calc(3.5rem+env(safe-area-inset-top))] flex w-[min(19.5rem,88vw)] flex-col border-r border-white/[0.08] bg-[#0D0D1A] pb-[env(safe-area-inset-bottom)] shadow-[8px_0_40px_rgba(0,0,0,0.45)]"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
              <NavLinks onNavigate={() => setOpen(false)} />
            </nav>
            <div className="space-y-2 border-t border-white/[0.06] px-3 py-3">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-xl border border-white/[0.06] px-3 py-2.5 text-xs text-[#8B8AA0]"
              >
                ← Kembali ke Dashboard
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#EC4899]/30 bg-[#EC4899]/10 px-3 py-2.5 text-xs font-semibold text-[#EC4899]"
              >
                <LogOut size={14} />
                Keluar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside
        className="fixed top-0 left-0 z-50 hidden h-screen w-[220px] flex-col border-r border-white/[0.06] md:flex"
        style={{ background: "#0D0D1A" }}
      >
        <div className="flex h-[60px] items-center gap-2.5 border-b border-white/[0.06] px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-gercep.png" alt="Gercep AI" className="h-7 w-7 rounded-lg object-cover" />
          <div>
            <span className="block text-sm font-bold text-[#F0EFF8]">Admin Panel</span>
            <span className="text-[9px] uppercase tracking-wide text-[#5A5B7A]">{role}</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3" style={{ scrollbarWidth: "none" }}>
          <NavLinks />
        </nav>

        <div className="space-y-2 border-t border-white/[0.06] px-4 py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs text-[#5A5B7A] transition-colors hover:text-[#8B8AA0]"
          >
            ← Kembali ke Dashboard
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-2 rounded-lg px-0 py-1 text-xs font-semibold text-[#EC4899] transition-colors hover:text-[#F472B6]"
          >
            <LogOut size={14} />
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
}
