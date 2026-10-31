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
        className={`${open ? "flex" : "hidden"} absolute inset-y-0 left-0 z-30 w-[220px] flex-col border-r border-[#243247] bg-[#0B1220]/80 backdrop-blur-md md:static md:flex`}
      >
        <div className="px-4 pb-3 pt-5">
          <p className="text-[11px] font-bold tracking-[0.22em] text-[#06D6D6]">HENIMA</p>
          <p className="text-sm font-bold">Tracking</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === active;
            const className = `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
              isActive ? "bg-[#06D6D6]/12 text-[#06D6D6]" : "text-[#94A3B8] hover:bg-white/[0.04]"
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
        <div className="m-3 flex items-center gap-2 rounded-xl border border-[#243247] px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-gercep.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
          <div>
            <p className="text-xs font-bold">GercepAI</p>
            <p className="text-[10px] font-medium text-[#94A3B8]">Henima Tracking</p>
          </div>
        </div>
      </aside>
      {open && <button type="button" aria-label="Tutup menu" className="absolute inset-0 z-20 bg-black/50 md:hidden" onClick={onClose} />}
    </>
  );
}
