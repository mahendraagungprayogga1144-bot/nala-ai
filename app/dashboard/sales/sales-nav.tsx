"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard/sales", label: "Dashboard KPI" },
  { href: "/dashboard/sales/customers", label: "Customers" },
  { href: "/dashboard/sales/orders", label: "Orders" },
  { href: "/dashboard/sales/testimonials", label: "Testimonials" },
  { href: "/dashboard/sales/follow-ups", label: "Follow Ups" },
  { href: "/dashboard/sales/targets", label: "Targets" },
  { href: "/dashboard/sales/commissions", label: "Commissions" },
  { href: "/dashboard/sales/reports", label: "Reports" },
  { href: "/dashboard/sales/team", label: "Settings" },
];

export default function SalesNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-1.5">
      {LINKS.map((l) => {
        const active = pathname === l.href || (l.href !== "/dashboard/sales" && pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              "rounded-lg border px-3 py-1.5 text-xs font-medium " +
              (active
                ? "border-[#2DD4BF]/50 bg-[#2DD4BF]/15 text-[#2DD4BF]"
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
