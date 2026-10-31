"use client";

import Link from "next/link";
import {
  Camera,
  FileBarChart,
  History,
  LayoutDashboard,
  MapPinned,
  Settings,
  Users,
} from "lucide-react";

export type TrackingNavKey = "tracking" | "riwayat";

const ITEMS: Array<{
  href: string;
  label: string;
  icon: typeof MapPinned;
  key?: TrackingNavKey;
  hash?: string;
}> = [
  { href: "/dashboard/owner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/henima-tracking", label: "Tracking", icon: MapPinned, key: "tracking" },
  { href: "/dashboard/sales", label: "Sales", icon: Users },
  { href: "/dashboard/henima-tracking#foto-checkin", label: "Foto Check-in", icon: Camera, hash: "foto-checkin" },
  { href: "/dashboard/henima-tracking/riwayat", label: "Riwayat", icon: History, key: "riwayat" },
  { href: "/dashboard/sales/reports", label: "Laporan", icon: FileBarChart },
  { href: "/dashboard/henima-tracking#tambah-sales", label: "Pengaturan", icon: Settings, hash: "tambah-sales" },
];

export function TrackingSidebar({
  active,
  open,
  onClose,
}: {
  active: TrackingNavKey;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <aside
        className={`${open ? "flex" : "hidden"} absolute inset-y-0 left-0 z-30 w-[232px] flex-col border-r border-[#E2E8F0] bg-white md:static md:flex`}
      >
        <div className="border-b border-[#E2E8F0] px-5 pb-4 pt-6">
          <p className="font-serif text-[22px] font-semibold leading-none tracking-tight text-[#0F172A]">HENIMA</p>
          <p className="mt-1 text-xs font-medium text-[#64748B]">Signature Scent</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === active;
            const className = `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              isActive
                ? "bg-[#2563EB] text-white shadow-sm shadow-blue-600/20"
                : "text-[#64748B] hover:bg-[#EFF6FF] hover:text-[#0F172A]"
            }`;
            if (item.hash) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => {
                    onClose();
                    if (typeof window !== "undefined" && window.location.pathname === "/dashboard/henima-tracking") {
                      window.requestAnimationFrame(() => {
                        document.getElementById(item.hash!)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }
                  }}
                  className={className}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            }
            return (
              <Link key={item.label} href={item.href} onClick={onClose} className={className}>
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 flex items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-gercep.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
          <div>
            <p className="text-xs font-bold text-[#0F172A]">GercepAI</p>
            <p className="text-[10px] font-medium text-[#64748B]">Henima Tracking</p>
          </div>
        </div>
      </aside>
      {open && <button type="button" aria-label="Tutup menu" className="absolute inset-0 z-20 bg-slate-900/30 md:hidden" onClick={onClose} />}
    </>
  );
}
