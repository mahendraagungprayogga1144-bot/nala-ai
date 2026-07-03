"use client";
import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import { Menu, X } from "lucide-react";

type Business = { id: string; name: string; type: string | null };

export default function DashboardShell({ children, businesses, activeBusiness, userName }: {
  children: React.ReactNode;
  businesses: Business[];
  activeBusiness: Business | null;
  userName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isMobile) {
    return (
      <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[#070711] text-[#F2F1F8]">
        <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0D0D1A] px-4">
          <span className="text-lg font-semibold">Gercep<span className="holo-text">AI</span></span>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-2 transition-colors hover:bg-white/[0.05]">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setMobileOpen(false)}>
            <div className="fixed top-14 left-0 bottom-0 z-50 w-64 overflow-y-auto border-r border-white/[0.06] bg-[#0D0D1A]"
              onClick={(e) => e.stopPropagation()}>
              <Sidebar embedded expanded={true} setExpanded={() => {}} businesses={businesses}
                activeBusiness={activeBusiness} userName={userName} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <main className="w-full min-w-0 max-w-full overflow-x-hidden pt-14">{children}</main>
      </div>
    );
  }

  return (
    <>
      <Sidebar expanded={expanded} setExpanded={setExpanded} businesses={businesses} activeBusiness={activeBusiness} userName={userName} />
      <main
        className="flex-1 overflow-x-hidden overflow-y-auto bg-[#070711] transition-[margin-left] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ marginLeft: expanded ? 220 : 64 }}
      >
        {children}
      </main>
    </>
  );
}
