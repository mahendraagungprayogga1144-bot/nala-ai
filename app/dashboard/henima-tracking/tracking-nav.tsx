"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import {
  CreditCard,
  FileBarChart,
  History,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Radar,
  Settings,
  ShoppingBag,
  Target,
} from "lucide-react";
import LogoutButton from "../logout-button";

export type TrackingNavKey = "dashboard" | "lokasi" | "traccar" | "riwayat";

const GOLD = "#C5A358";

type NavItem = {
  href: string;
  label: string;
  icon: typeof MapPinned;
  key?: TrackingNavKey;
  panel?: "dashboard" | "lokasi" | "traccar";
  hash?: string;
};

const ITEMS: NavItem[] = [
  { href: "/dashboard/henima-tracking", label: "Dashboard", icon: LayoutDashboard, key: "dashboard", panel: "dashboard" },
  { href: "/dashboard/henima-tracking#lokasi", label: "Lokasi GPS", icon: MapPinned, key: "lokasi", panel: "lokasi" },
  { href: "/dashboard/henima-tracking#traccar", label: "Server Traccar", icon: Radar, key: "traccar", panel: "traccar" },
  { href: "/dashboard/sales/orders", label: "Catat Penjualan", icon: ShoppingBag },
  { href: "/dashboard/sales/orders", label: "Pembayaran", icon: CreditCard },
  { href: "/dashboard/sales/reports", label: "Laporan", icon: FileBarChart },
  { href: "/dashboard/sales/targets", label: "Target & Bonus", icon: Target },
  { href: "/dashboard/henima-tracking/riwayat", label: "Riwayat GPS", icon: History, key: "riwayat" },
  { href: "/dashboard/henima-tracking#tambah-sales", label: "Pengaturan", icon: Settings, hash: "tambah-sales", panel: "lokasi" },
];

function NavPendingHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-current transition ${pending ? "animate-pulse opacity-100" : "opacity-0"}`}
    />
  );
}

export function TrackingSidebar({
  active,
  open,
  onClose,
  onPanel,
}: {
  active: TrackingNavKey;
  open: boolean;
  onClose: () => void;
  onPanel?: (panel: "dashboard" | "lokasi" | "traccar") => void;
}) {
  return (
    <>
      <aside
        className={`${open ? "flex" : "hidden"} absolute inset-y-0 left-0 z-30 w-[240px] flex-col border-r border-[#E8E8E4] bg-white md:static md:flex`}
      >
        <div className="px-5 pb-2 pt-6">
          <p className="text-[22px] font-bold tracking-[0.06em] text-[#111]">HENIMA</p>
          <p className="mt-1 text-xs font-medium tracking-wide text-[#8A8A8A]">Tracking</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === active;
            const className = `flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition ${
              isActive ? "bg-[#F7F4EC] text-[#111]" : "text-[#6B6B6B] hover:bg-[#FAFAF8] hover:text-[#111]"
            }`;

            if (item.panel && onPanel && (item.panel === "dashboard" || item.panel === "lokasi" || item.panel === "traccar")) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    onPanel(item.panel!);
                    if (item.hash) {
                      window.requestAnimationFrame(() => {
                        document.getElementById(item.hash!)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }
                    onClose();
                  }}
                  className={className}
                >
                  <Icon size={16} color={isActive ? GOLD : undefined} />
                  {item.label}
                </button>
              );
            }

            if (item.hash) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => {
                    onClose();
                    if (typeof window !== "undefined" && window.location.pathname === "/dashboard/henima-tracking") {
                      onPanel?.("lokasi");
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
              <Link key={item.label} href={item.href} onClick={onClose} className={className} prefetch>
                <Icon size={16} color={isActive ? GOLD : undefined} />
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {item.label}
                  {item.key ? <NavPendingHint /> : null}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[#E8E8E4] p-3">
          <LogoutButton className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm font-semibold text-[#6B6B6B] hover:bg-[#FAFAF8] hover:text-[#111]">
            <>
              <LogOut size={16} />
              Keluar
            </>
          </LogoutButton>
        </div>
      </aside>
      {open && <button type="button" aria-label="Tutup menu" className="absolute inset-0 z-20 bg-black/20 md:hidden" onClick={onClose} />}
    </>
  );
}
