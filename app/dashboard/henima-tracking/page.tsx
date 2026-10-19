import { Activity } from "lucide-react";
import ModuleHeader from "../components/module-header";
import { guardPage } from "../lib/page-guard";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { isMissingTrackingTable, loadTrackingDesk } from "@/lib/henima-tracking/service";
import TrackingDesk from "./tracking-desk";

export default function HenimaTrackingPage() {
  return guardPage("Henima Tracking", async () => {
    try {
      const { actor, db } = await loadSalesContext();
      const desk = await loadTrackingDesk(db, actor);
      return (
        <div className="mx-auto max-w-6xl px-4 py-4 pb-12 sm:px-8 sm:py-8">
          <ModuleHeader
            icon={Activity}
            title="Henima Tracking"
            subtitle="Peta jejak sales. Setelah check-in, kemana pun mereka pergi kelihatan. Setelah check-out, hari itu tidak bisa check-in lagi."
          />
          <TrackingDesk date={desk.date} links={desk.links} points={desk.points} />
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
        </div>
      );
    }
  });
}
