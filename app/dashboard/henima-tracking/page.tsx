import { Activity } from "lucide-react";
import { Plus_Jakarta_Sans } from "next/font/google";
import ModuleHeader from "../components/module-header";
import { guardPage } from "../lib/page-guard";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { createClient } from "@/lib/supabase/server";
import { isMissingTrackingTable, loadTrackingDesk } from "@/lib/henima-tracking/service";
import { loadOwnerDashboardSummary } from "@/lib/henima-tracking/owner-dashboard";
import { listHandStock, listStockIssues } from "@/lib/henima-sales/hand-stock-service";
import { listProducts, listStaff } from "@/lib/henima-sales/staff-service";
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
      const [desk, summary, hand, issues, products, staff] = await Promise.all([
        loadTrackingDesk(db, session, actor, day),
        loadOwnerDashboardSummary(db, actor).catch(() => null),
        listHandStock(db, actor).catch(() => []),
        actor.role === "SALES" ? Promise.resolve([]) : listStockIssues(db, actor).catch(() => []),
        listProducts(db, actor.businessId).catch(() => []),
        listStaff(db, actor).catch(() => []),
      ]);
      const { data: auth } = await session.auth.getUser();
      let ownerName = "Owner";
      if (auth.user) {
        const { data: profile } = await session.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle();
        ownerName = profile?.full_name || auth.user.email?.split("@")[0] || "Owner";
      }
      return (
        <div className={`${jakarta.className} flex h-full min-h-0 flex-col bg-white text-[#111111]`}>
          <TrackingDesk
            date={desk.date}
            today={desk.today}
            days={desk.days}
            links={desk.links}
            points={desk.points}
            notice={desk.notice}
            ownerName={ownerName}
            qrisUrl={desk.qrisUrl}
            summary={summary}
            stock={{
              canEdit: actor.role !== "SALES",
              hand,
              issues,
              products: products.map((p) => ({ id: p.id, name: p.name, stock: p.stock ?? 0 })),
              staff: staff
                .filter((s) => s.role === "SALES" || s.role === "LEADER")
                .filter((s) => s.status === "active" || s.status === "pending")
                .map((s) => ({ id: s.id, nama: s.nama })),
            }}
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
