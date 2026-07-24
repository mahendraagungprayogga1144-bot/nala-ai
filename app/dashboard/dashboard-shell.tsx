"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./sidebar";
import TrialBanner from "./components/trial-banner";
import { Menu, X } from "lucide-react";
import { blockedPathForFlags } from "@/lib/admin/feature-gate";

type Business = { id: string; name: string; type: string | null };
type Flags = { ai_kasir?: boolean; ai_jual_beli?: boolean; marketplace?: boolean; pajak?: boolean };

/**
 * CSS-first responsive shell — no isMobile useState flash.
 */
export default function DashboardShell({
  children,
  businesses,
  activeBusiness,
  userName,
  userEmail,
  featureFlags,
  announcement,
}: {
  children: React.ReactNode;
  businesses: Business[];
  activeBusiness: Business | null;
  userName?: string;
  userEmail?: string;
  featureFlags?: Flags;
  announcement?: { enabled: boolean; message: string; link: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [announceDismissed, setAnnounceDismissed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (blockedPathForFlags(pathname || "", featureFlags)) {
      router.replace("/dashboard/owner");
    }
  }, [pathname, featureFlags, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("gercep_announce_dismissed") === "1") {
      setAnnounceDismissed(true);
    }
  }, []);

  const sidebarProps = {
    businesses,
    activeBusiness,
    userName,
    userEmail,
    featureFlags,
  };

  const showAnnounce =
    announcement?.enabled &&
    announcement.message?.trim() &&
    !announceDismissed;

  return (
    <div className="min-h-[100dvh] w-full min-w-0 overflow-x-hidden bg-[#070711] text-[#F2F1F8] md:flex">
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
              onNavigate={() => setMobileOpen(false)}
              {...sidebarProps}
            />
          </div>
        </div>
      )}

      <div className="hidden md:block">
        <Sidebar expanded={expanded} setExpanded={setExpanded} {...sidebarProps} />
      </div>

      <main
        className={[
          "w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto bg-[#070711]",
          "pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)]",
          "md:pt-0 md:pb-0",
          expanded ? "md:ml-[220px]" : "md:ml-16",
          "md:transition-[margin-left] md:duration-[220ms] md:ease-[cubic-bezier(0.4,0,0.2,1)]",
        ].join(" ")}
      >
        {showAnnounce && (
          <div className="flex items-start gap-3 border-b border-[#38BDF8]/25 bg-[#38BDF8]/10 px-4 py-2.5 text-sm text-[#E0F2FE]">
            <p className="min-w-0 flex-1 leading-relaxed">
              {announcement!.message}
              {announcement!.link ? (
                <>
                  {" "}
                  <a
                    href={announcement!.link}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline"
                  >
                    Selengkapnya
                  </a>
                </>
              ) : null}
            </p>
            <button
              type="button"
              className="shrink-0 text-xs text-[#8B8AA0] hover:text-white"
              onClick={() => {
                sessionStorage.setItem("gercep_announce_dismissed", "1");
                setAnnounceDismissed(true);
              }}
            >
              Tutup
            </button>
          </div>
        )}
        <TrialBanner />
        {children}
      </main>
    </div>
  );
}
