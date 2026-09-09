import { Target } from "lucide-react";
import ModuleHeader from "../components/module-header";
import { guardPage } from "../lib/page-guard";
import SalesNav from "./sales-nav";
import DashboardClient from "./dashboard-client";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { buildSalesReport, type ReportKind } from "@/lib/henima-sales/report-service";
import { todayFollowUps } from "@/lib/henima-sales/followup-service";
import { listStaff } from "@/lib/henima-sales/staff-service";
import { getCustomer } from "@/lib/henima-sales/customer-service";

const KINDS = new Set<ReportKind>([
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_year",
  "all",
  "custom",
]);

export default function SalesDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; from?: string; to?: string }>;
}) {
  return guardPage("Henima Sales", async () => {
    const params = await searchParams;
    const kind = KINDS.has((params.kind || "") as ReportKind) ? (params.kind as ReportKind) : "this_month";
    const { actor, db } = await loadSalesContext();
    const [report, follow, staff] = await Promise.all([
      buildSalesReport(db, actor, { kind, from: params.from, to: params.to }),
      todayFollowUps(db, actor),
      listStaff(db, actor),
    ]);

    const followCards = await Promise.all(
      follow.rows.slice(0, 8).map(async (f) => {
        try {
          const c = await getCustomer(db, actor, f.customer_id);
          return { id: f.id, customerId: f.customer_id, nama: c.nama, lastPurchase: c.last_purchase_at };
        } catch {
          return { id: f.id, customerId: f.customer_id, nama: "Customer", lastPurchase: null };
        }
      }),
    );

    return (
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
        <ModuleHeader
          icon={Target}
          title={actor.businessName}
          subtitle={`Pantau penjualan · ${actor.nama} · ${actor.role}`}
        />
        <SalesNav />
        <DashboardClient
          initialKind={kind}
          initial={report}
          staff={staff.map((s) => ({
            id: s.id,
            nama: s.nama,
            role: s.role,
            status: s.status,
            telegram_user_id: s.telegram_user_id,
          }))}
          follow={followCards}
        />
      </div>
    );
  });
}
