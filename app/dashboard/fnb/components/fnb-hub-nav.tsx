"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, UtensilsCrossed, ShoppingCart, Users } from "lucide-react";
import { FNB_NAV_HEIGHT_PX } from "../lib/mobile-layout";

const LINKS = [
  { href: "/dashboard/inventory", label: "Stok", icon: Package, match: "/inventory" },
  { href: "/dashboard/master-menu", label: "Menu", icon: UtensilsCrossed, match: "/master-menu" },
  { href: "/dashboard/ai-kasir", label: "Kasir", icon: ShoppingCart, match: "/ai-kasir" },
  { href: "/dashboard/karyawan-toko", label: "Tim", icon: Users, match: "/karyawan-toko" },
];

function NavLink({ l, active, mobile }: { l: typeof LINKS[0]; active: boolean; mobile?: boolean }) {
  if (mobile) {
    return (
      <Link
        href={l.href}
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-medium transition-colors ${
          active ? "text-[#2DD4BF]" : "text-[#5A5B7A]"
        }`}
        style={{ minHeight: FNB_NAV_HEIGHT_PX }}
      >
        <l.icon size={20} strokeWidth={active ? 2.25 : 1.75} />
        <span className="leading-none">{l.label}</span>
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
      <nav className="mb-6 hidden gap-2 overflow-x-auto pb-1 scrollbar-none md:flex">
        {LINKS.map(l => (
          <NavLink key={l.href} l={l} active={pathname.includes(l.match)} />
        ))}
      </nav>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-[#0D0D1A] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navigasi F&B"
      >
        <div className="flex" style={{ height: FNB_NAV_HEIGHT_PX }}>
          {LINKS.map(l => (
            <NavLink key={l.href} l={l} active={pathname.includes(l.match)} mobile />
          ))}
        </div>
      </nav>
    </>
  );
}
