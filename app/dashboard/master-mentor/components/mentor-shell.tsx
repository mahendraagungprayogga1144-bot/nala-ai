"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import MentorNav from "./mentor-nav";

export default function MentorShell({
  ownerName,
  children,
}: {
  ownerName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openForPath, setOpenForPath] = useState(pathname);
  const drawerOpen = mobileOpen && openForPath === pathname;

  const openMenu = () => {
    setOpenForPath(pathname);
    setMobileOpen(true);
  };

  const closeMenu = () => setMobileOpen(false);

  return (
    <div className="flex h-full min-h-0 w-full bg-white text-[#111827]">
      <div className="hidden w-[260px] shrink-0 md:block">
        <MentorNav ownerName={ownerName} />
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/30"
            onClick={closeMenu}
          />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-xl">
            <MentorNav ownerName={ownerName} onNavigate={closeMenu} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={openMenu}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#374151]"
            aria-label="Open menu"
          >
            {drawerOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#111827]">HENIMA AI</p>
            <p className="truncate text-xs text-[#6B7280]">Business Master Mentor</p>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-white">{children}</main>
      </div>
    </div>
  );
}
