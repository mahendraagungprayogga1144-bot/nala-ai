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
      return (
        <div className={`${jakarta.className} flex h-[calc(100dvh-4.75rem)] min-h-[640px] flex-col bg-[#080D18] px-3 pb-3 pt-3 md:h-screen`}>
          <TrackingDesk
            date={desk.date}
            today={desk.today}
            days={desk.days}
            links={desk.links}
            points={desk.points}
            notice={desk.notice}
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
