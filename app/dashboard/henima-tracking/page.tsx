import { Activity } from "lucide-react";
import { Plus_Jakarta_Sans } from "next/font/google";
import ModuleHeader from "../components/module-header";
import { guardPage } from "../lib/page-guard";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { createClient } from "@/lib/supabase/server";
import { isMissingTrackingTable, loadTrackingDesk } from "@/lib/henima-tracking/service";
import { todayWib } from "@/lib/date";
import TrackingDesk from "./tracking-desk";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

function chosenDay(raw: string | undefined) {
  const today = todayWib();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || raw > today) return today;
  return raw;
}

export default async function HenimaTrackingPage({ searchParams }: { searchParams: Promise<{ hari?: string }> }) {
  const { hari } = await searchParams;
  const day = chosenDay(hari);
  return guardPage("Henima Tracking", async () => {
    try {
      const [{ actor, db }, session] = await Promise.all([loadSalesContext(), createClient()]);
      const desk = await loadTrackingDesk(db, session, actor, day);
      const { data: auth } = await session.auth.getUser();
      let ownerName = "Owner";
      if (auth.user) {
        const { data: profile } = await session.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle();
        ownerName = profile?.full_name || auth.user.email?.split("@")[0] || "Owner";
      }
      return (
        <div
          className={`${jakarta.className} flex h-full min-h-0 flex-col bg-[#080D18] bg-cover bg-center`}
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(8,13,24,0.55), rgba(8,13,24,0.72)), url(/henima-tracking-bg.jpg)",
          }}
        >
          <TrackingDesk
            date={desk.date}
            today={desk.today}
            days={desk.days}
            links={desk.links}
            points={desk.points}
            notice={desk.notice}
            ownerName={ownerName}
            qrisUrl={desk.qrisUrl}
          />
        </div>
      );
    } catch (err) {
      if (!isMissingTrackingTable(err)) throw err;
      return (
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
          <ModuleHeader icon={Activity} title="Henima Tracking" subtitle="Belum aktif di database." />
          <p className="text-sm text-[#8B8AA0]">
            Jalankan migration <code>20261019_henima_tracking.sql</code> di Supabase, lalu muat ulang halaman ini.
          </p>
          <p className="mt-3 text-xs text-[#8B8AA0]">{err instanceof Error ? err.message : "Gagal memuat tracking."}</p>
        </div>
      );
    }
  });
}
