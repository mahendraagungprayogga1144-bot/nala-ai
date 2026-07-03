"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, UtensilsCrossed, ShoppingCart, Users } from "lucide-react";

const LINKS = [
  { href: "/dashboard/inventory", label: "Stok", icon: Package, match: "/inventory" },
  { href: "/dashboard/fnb/menu", label: "Menu", icon: UtensilsCrossed, match: "/fnb/menu" },
  { href: "/dashboard/fnb/kasir", label: "Kasir", icon: ShoppingCart, match: "/fnb/kasir" },
  { href: "/dashboard/fnb/karyawan", label: "Tim", icon: Users, match: "/fnb/karyawan" },
];

function NavLink({ l, active, mobile }: { l: typeof LINKS[0]; active: boolean; mobile?: boolean }) {
  if (mobile) {
    return (
      <Link
        href={l.href}
        className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
          active ? "text-[#2DD4BF]" : "text-[#5A5B7A]"
        }`}
      >
        <l.icon size={22} strokeWidth={active ? 2.25 : 1.75} />
        {l.label}
      </Link>
    );
  }
  return (
    <Link
      href={l.href}
      className={[
        "flex flex-shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
        active
          ? "border-[#2DD4BF]/40 bg-gradient-to-r from-[#2DD4BF]/20 to-[#8B5CF6]/10 text-[#2DD4BF] shadow-[0_0_20px_rgba(45,212,191,0.12)]"
          : "border-white/[0.08] bg-white/[0.03] text-[#8B8AA0] hover:border-white/15 hover:text-[#F2F1F8]",
      ].join(" ")}
    >
      <l.icon size={16} />
      {l.label}
    </Link>
  );
}

export default function FnbHubNav() {
  const pathname = usePathname();
  return (
    <>
      {/* Desktop / tablet — top tabs */}
      <nav className="mb-6 hidden gap-2 overflow-x-auto pb-1 scrollbar-none md:flex">
        {LINKS.map(l => (
          <NavLink key={l.href} l={l} active={pathname.includes(l.match)} />
        ))}
      </nav>

      {/* Mobile — bottom tab bar (app-like) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#0D0D1A]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navigasi F&B"
      >
        <div className="flex">
          {LINKS.map(l => (
            <NavLink key={l.href} l={l} active={pathname.includes(l.match)} mobile />
          ))}
        </div>
      </nav>
    </>
  );
}
