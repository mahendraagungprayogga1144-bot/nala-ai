"use client";
import { usePathname } from "next/navigation";
import {
  Wallet, Store, MessageCircle, Package, Factory, Bird, Calculator, Sprout,
  ShoppingCart, Users, Megaphone, BarChart3, QrCode, Receipt, FileText, Gauge,
} from "lucide-react";
import BusinessSwitcher from "./business-switcher";

const baseModules = [
  { name: "Dashboard Owner", href: "/dashboard/owner", icon: Gauge, label: "MENU UTAMA" },
  { name: "Gercep Chat", href: "/dashboard/chat", icon: MessageCircle },
  { name: "Keuangan Bisnis", href: "/dashboard/keuangan-bisnis", icon: Store },
  { name: "Keuangan Pribadi", href: "/dashboard/keuangan-pribadi", icon: Wallet },
  { name: "Inventory", href: "/dashboard/inventory", icon: Package, label: "MANAJEMEN" },
];

const homeindustry_modules = [
  { name: "Produksi", href: "/dashboard/produksi", icon: Factory },
];

const ternak_modules = [
  { name: "Manajemen Ternak", href: "/dashboard/peternakan", icon: Bird },
];

const pertanian_modules = [
  { name: "Modul Pertanian", href: "/dashboard/pertanian", icon: Sprout },
];

const fnb_modules = [
  { name: "Master Menu", href: "/dashboard/fnb/menu", icon: Receipt },
  { name: "Kasir", href: "/dashboard/fnb/kasir", icon: ShoppingCart },
  { name: "Karyawan", href: "/dashboard/fnb/karyawan", icon: Users },
];

const extraModules = [
  { name: "Smart Profit Calculator", href: "/dashboard/smart-profit", icon: Calculator, label: "MODUL LANJUTAN" },
  { name: "CRM Pelanggan", href: "#", icon: Users, disabled: true },
  { name: "AI Marketing", href: "#", icon: Megaphone, disabled: true },
  { name: "AI Riset Bisnis", href: "#", icon: BarChart3, disabled: true },
  { name: "Barcode QR Analyzer", href: "#", icon: QrCode, disabled: true },
  { name: "Pajak NPWP Center", href: "#", icon: FileText, disabled: true },
];

type Business = { id: string; name: string; type: string | null };

export default function Sidebar({ expanded, setExpanded, businesses, activeBusiness, userName, onNavigate, embedded }: {
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  businesses: Business[];
  activeBusiness: Business | null;
  userName?: string;
  onNavigate?: () => void;
  embedded?: boolean;
}) {
  const pathname = usePathname();
  const bizType = activeBusiness?.type;

  const allModules = [
    ...baseModules,
    ...(bizType === "homeindustry" ? homeindustry_modules : []),
    ...(bizType === "ternak" ? ternak_modules : []),
    ...(bizType === "pertanian" ? pertanian_modules : []),
    ...(bizType === "kuliner" ? fnb_modules : []),
    ...extraModules,
  ];

  return (
    <aside
      className={[
        "flex h-screen flex-col overflow-hidden border-r border-white/[0.06] bg-[#0D0D1A] z-50",
        embedded ? "relative w-full" : "fixed top-0 left-0",
      ].join(" ")}
      style={{
        width: embedded ? "100%" : expanded ? 220 : 64,
        transition: embedded ? undefined : "width 0.22s cubic-bezier(0.4,0,0.2,1)",
      }}
      onMouseEnter={() => !embedded && setExpanded(true)}
      onMouseLeave={() => !embedded && setExpanded(false)}
    >
      <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-10 blur-[60px]"
        style={{ background: "radial-gradient(circle, #2DD4BF, transparent)" }} />

      <div className="flex h-[60px] flex-shrink-0 items-center gap-2.5 border-b border-white/[0.06] px-4">
        <div className="gercep-gradient-btn flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold">G</div>
        {expanded && (
          <span className="whitespace-nowrap text-sm font-bold text-[#F0EFF8]">
            GERCEP <span className="holo-text">AI</span>
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" style={{ scrollbarWidth: "none" }}>
        {allModules.map((m) => {
          const mod = m as { label?: string; disabled?: boolean };
          const isDisabled = mod.disabled;
          const isActive = !isDisabled && (pathname === m.href || (m.href !== "/dashboard/chat" && pathname.startsWith(m.href + "/")));
          const showLabel = expanded && mod.label;
          const itemCls = [
            "mb-0.5 flex items-center gap-2.5 rounded-lg transition-all duration-200",
            expanded ? "px-2.5 py-[7px]" : "justify-center p-[7px]",
            isDisabled
              ? "border border-transparent text-[#3A3B52] opacity-50 cursor-not-allowed"
              : isActive
                ? "border border-[#2DD4BF]/20 bg-gradient-to-r from-[#2DD4BF]/[0.12] to-[#8B5CF6]/[0.08] text-[#2DD4BF]"
                : "border border-transparent text-[#5A5B7A] hover:bg-white/[0.03] hover:text-[#8B8AA0]",
          ].join(" ");

          return (
            <div key={m.href + m.name}>
              {showLabel && (
                <p className="mb-1.5 mt-3 px-2 text-[9px] font-semibold tracking-[0.08em] text-[#3A3B52] whitespace-nowrap">
                  {mod.label}
                </p>
              )}
              {isDisabled ? (
                <div title={`${m.name} — coming soon`} className={itemCls}>
                  <m.icon size={15} className="flex-shrink-0" />
                  {expanded && (
                    <>
                      <span className="ml-2.5 whitespace-nowrap text-xs font-medium">{m.name}</span>
                      <span className="ml-auto text-[9px] font-medium text-[#5A5B7A]">Soon</span>
                    </>
                  )}
                </div>
              ) : (
                <a
                  href={m.href}
                  onClick={() => onNavigate?.()}
                  title={m.name}
                  className={itemCls}
                >
                  <m.icon size={15} className="flex-shrink-0" />
                  {expanded && <span className="ml-2.5 whitespace-nowrap text-xs font-medium">{m.name}</span>}
                </a>
              )}
            </div>
          );
        })}
      </nav>

      {expanded && (
        <div className="mx-2 mb-2 rounded-xl border border-[#2DD4BF]/15 bg-gradient-to-br from-[#2DD4BF]/[0.08] to-[#8B5CF6]/[0.06] p-3">
          <p className="mb-0.5 text-xs font-semibold text-[#2DD4BF]">🚀 Upgrade ke Pro</p>
          <p className="mb-2.5 text-[10px] leading-relaxed text-[#5A5B7A]">Akses semua fitur premium tanpa batas</p>
          <button className="gercep-gradient-btn w-full cursor-pointer rounded-lg py-1.5 text-[11px] font-bold transition-opacity hover:opacity-90">
            Upgrade Sekarang
          </button>
        </div>
      )}

      {expanded && <BusinessSwitcher businesses={businesses} activeBusiness={activeBusiness} />}

      <div className="flex-shrink-0 border-t border-white/[0.06] px-2 py-3">
        {expanded ? (
          <div className="flex items-center gap-2 px-2">
            <div className="gercep-gradient-btn flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
              {userName ? userName[0].toUpperCase() : "M"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#F0EFF8]">{userName || "Owner"}</p>
              <p className="text-[10px] text-[#5A5B7A]">{businesses.length} bisnis</p>
            </div>
            <a href="/login" className="ml-auto text-[10px] text-[#5A5B7A] transition-colors hover:text-[#EC4899]">Keluar</a>
          </div>
        ) : (
          <div className="flex justify-center">
            <a href="/login" title="Keluar" className="text-xs text-[#5A5B7A] transition-colors hover:text-[#EC4899]">↩</a>
          </div>
        )}
      </div>
    </aside>
  );
}
