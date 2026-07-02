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

export default function FnbHubNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {LINKS.map(l => {
        const active = pathname.includes(l.match);
        return (
          <Link
            key={l.href}
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
      })}
    </nav>
  );
}
