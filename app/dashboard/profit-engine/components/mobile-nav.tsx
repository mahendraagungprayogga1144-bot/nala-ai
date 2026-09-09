"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Megaphone, SlidersHorizontal, Settings } from "lucide-react";

const ITEMS = [
  { href: "/dashboard/profit-engine", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/profit-engine/calculator", label: "Products", icon: Package },
  { href: "/dashboard/profit-engine/campaigns", label: "Ads", icon: Megaphone },
  { href: "/dashboard/profit-engine/simulator", label: "Simulator", icon: SlidersHorizontal },
  { href: "/dashboard/profit-engine/settings", label: "Settings", icon: Settings },
];

export default function ProfitMobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0B0B16]/96 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${
                active ? "text-[#F5D76E]" : "text-[#6B6A85]"
              }`}
            >
              <item.icon size={18} strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
