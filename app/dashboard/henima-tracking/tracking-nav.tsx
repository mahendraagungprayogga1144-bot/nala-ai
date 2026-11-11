"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import {
  Boxes,
  CreditCard,
  FileBarChart,
  History,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Package,
  Settings,
  ShoppingBag,
  Target,
  UserCog,
  Users,
} from "lucide-react";
import LogoutButton from "../logout-button";

export type TrackingNavKey = "dashboard" | "lokasi" | "stok" | "hr" | "riwayat";
export type TrackingPanel = "dashboard" | "lokasi" | "stok" | "hr";

const GOLD = "#C5A358";

type NavItem = {
  href: string;
  label: string;
  icon: typeof MapPinned;
  key?: TrackingNavKey;
  panel?: TrackingPanel;
  hash?: string;
};

const ITEMS: NavItem[] = [
  { href: "/dashboard/henima-tracking", label: "Dashboard", icon: LayoutDashboard, key: "dashboard", panel: "dashboard" },
  { href: "/dashboard/henima-tracking#lokasi", label: "Lokasi GPS", icon: MapPinned, key: "lokasi", panel: "lokasi" },
  { href: "/dashboard/sales/orders", label: "Penjualan", icon: ShoppingBag },
  { href: "/dashboard/sales/orders", label: "Pembayaran", icon: CreditCard },
  { href: "/dashboard/sales/studio", label: "Produk", icon: Package },
  { href: "/dashboard/sales/customers", label: "Customer CRM", icon: Users },
  { href: "/dashboard/sales/targets", label: "Target & Komisi", icon: Target },
  { href: "/dashboard/henima-tracking#stok", label: "Stok Gudang", icon: Boxes, key: "stok", panel: "stok" },
  { href: "/dashboard/henima-tracking#hr", label: "HR & Gaji", icon: UserCog, key: "hr", panel: "hr" },
  { href: "/dashboard/sales/reports", label: "Laporan", icon: FileBarChart },
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
  ownerName,
}: {
  active: TrackingNavKey;
  open: boolean;
  onClose: () => void;
  onPanel?: (panel: TrackingPanel) => void;
  ownerName?: string;
}) {
  return (
    <>
      <aside
        className={`${open ? "flex" : "hidden"} absolute inset-y-0 left-0 z-30 w-[240px] flex-col border-r border-[#E8E8E4] bg-white md:static md:flex`}
      >
        <div className="px-5 pb-2 pt-6">
          <p className="text-[22px] font-bold tracking-[0.06em] text-[#111]">HENIMA</p>
          <p className="mt-1 text-xs font-medium tracking-wide text-[#8A8A8A]">Sales Command Center</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === active;
            const className = `flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition ${
              isActive ? "bg-[#F7F4EC] text-[#111]" : "text-[#6B6B6B] hover:bg-[#FAFAF8] hover:text-[#111]"
            }`;

            if (item.panel && onPanel) {
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
          <div className="mb-2 rounded-2xl border border-[#E8D9A8] bg-[#F7F4EC] px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: GOLD }}>
              Departemen Sales
            </p>
            <p className="mt-0.5 text-xs font-semibold text-[#111]">Data dari app lapangan & order lunas</p>
          </div>
          {ownerName ? (
            <div className="mb-2 flex items-center gap-2 px-1 py-1">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: GOLD }}
              >
                {ownerName
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() || "")
                  .join("") || "O"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-[#111]">{ownerName}</p>
                <p className="text-[10px] text-[#8A8A8A]">Owner</p>
              </div>
            </div>
          ) : null}
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
