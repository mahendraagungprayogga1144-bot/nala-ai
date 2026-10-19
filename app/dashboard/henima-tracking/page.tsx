import { Activity } from "lucide-react";
import ModuleHeader from "../components/module-header";
import { guardPage } from "../lib/page-guard";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { createClient } from "@/lib/supabase/server";
import { isMissingTrackingTable, loadTrackingDesk } from "@/lib/henima-tracking/service";
import TrackingDesk from "./tracking-desk";

export default function HenimaTrackingPage() {
  return guardPage("Henima Tracking", async () => {
    try {
      const [{ actor, db }, session] = await Promise.all([loadSalesContext(), createClient()]);
      const desk = await loadTrackingDesk(db, session, actor);
      return (
        <div className="flex h-[calc(100dvh-4.75rem)] min-h-[640px] flex-col px-3 pb-3 pt-3 md:h-screen">
          <ModuleHeader
            icon={Activity}
            title="Henima Tracking"
            subtitle="Peta jejak sales. Setelah check-in, kemana pun mereka pergi kelihatan. Setelah check-out, hari itu tidak bisa check-in lagi."
          />
          <TrackingDesk date={desk.date} links={desk.links} points={desk.points} notice={desk.notice} />
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
