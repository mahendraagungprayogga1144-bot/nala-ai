"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, Package, Megaphone, SlidersHorizontal, Compass, Settings } from "lucide-react";

export const PE_LINKS = [
  { href: "/dashboard/profit-engine", label: "Overview", icon: Gauge },
  { href: "/dashboard/profit-engine/calculator", label: "Calculator", icon: Package },
  { href: "/dashboard/profit-engine/products", label: "Products", icon: Package },
  { href: "/dashboard/profit-engine/campaigns", label: "Ads", icon: Megaphone },
  { href: "/dashboard/profit-engine/simulator", label: "Simulator", icon: SlidersHorizontal },
  { href: "/dashboard/profit-engine/decide", label: "What should I do?", icon: Compass },
  { href: "/dashboard/profit-engine/settings", label: "Fee Rules", icon: Settings },
];

export default function ProfitEngineNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-5 hidden flex-wrap gap-1.5 md:flex">
      {PE_LINKS.map((l) => {
        const active =
          pathname === l.href || (l.href !== "/dashboard/profit-engine" && pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              "rounded-lg border px-3 py-1.5 text-xs font-medium " +
              (active
                ? "border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#F5D76E]"
                : "border-white/10 text-[#8B8AA0] hover:text-[#F0EFF8]")
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
