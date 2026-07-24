"use client";
import { useState } from "react";
import Sidebar from "./sidebar";
import TrialBanner from "./components/trial-banner";
import { Menu, X } from "lucide-react";

type Business = { id: string; name: string; type: string | null };

/**
 * CSS-first responsive shell — no isMobile useState flash.
 * (Previously: first paint desktop → remount mobile → first tap lost / butuh klik 2×)
 */
export default function DashboardShell({
  children,
  businesses,
  activeBusiness,
  userName,
  userEmail,
}: {
  children: React.ReactNode;
  businesses: Business[];
  activeBusiness: Business | null;
  userName?: string;
  userEmail?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] w-full min-w-0 overflow-x-hidden bg-[#070711] text-[#F2F1F8] md:flex">
      {/* Mobile top bar */}
      <div
        className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between border-b border-white/[0.06] bg-[#0D0D1A]/95 px-4 backdrop-blur-md md:hidden"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          height: "calc(3.5rem + env(safe-area-inset-top))",
        }}
      >
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-gercep.png" alt="" className="h-7 w-7 rounded-lg object-cover" />
          <span className="text-base font-semibold">
            Gercep<span className="holo-text">AI</span>
          </span>
        </div>
        <button
          type="button"
          aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg p-2 transition-colors hover:bg-white/[0.05] active:bg-white/[0.08]"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className="fixed top-0 bottom-0 left-0 z-50 w-[min(18rem,85vw)] overflow-y-auto border-r border-white/[0.06] bg-[#0D0D1A]"
            style={{ paddingTop: "calc(3.5rem + env(safe-area-inset-top))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar
              embedded
              expanded={true}
              setExpanded={() => {}}
              businesses={businesses}
              activeBusiness={activeBusiness}
              userName={userName}
              userEmail={userEmail}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar
          expanded={expanded}
          setExpanded={setExpanded}
          businesses={businesses}
          activeBusiness={activeBusiness}
          userName={userName}
          userEmail={userEmail}
        />
      </div>

      {/* Main — mobile top padding; desktop left margin for fixed sidebar */}
      <main
        className={[
          "w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto bg-[#070711]",
          "pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)]",
          "md:pt-0 md:pb-0",
          expanded ? "md:ml-[220px]" : "md:ml-16",
          "md:transition-[margin-left] md:duration-[220ms] md:ease-[cubic-bezier(0.4,0,0.2,1)]",
        ].join(" ")}
      >
        <TrialBanner />
        {children}
      </main>
    </div>
  );
}
