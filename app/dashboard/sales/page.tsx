import { Target } from "lucide-react";
import ModuleHeader from "../components/module-header";
import { MODULE_CARD } from "../components/module-form-styles";
import { guardPage } from "../lib/page-guard";
import SalesNav from "./sales-nav";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { buildSalesReport } from "@/lib/henima-sales/report-service";
import { achievementFor } from "@/lib/henima-sales/target-service";
import { todayFollowUps } from "@/lib/henima-sales/followup-service";
import { listStaff } from "@/lib/henima-sales/staff-service";
import { fmtRp } from "@/lib/henima-sales/money";
import { getCustomer } from "@/lib/henima-sales/customer-service";
import Link from "next/link";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className={MODULE_CARD}>
      <p className="text-[10px] uppercase tracking-wide text-[#8B8AA0]">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-[#F0EFF8]">{value}</p>
    </div>
  );
}

export default function SalesDashboardPage() {
  return guardPage("Henima Sales", async () => {
    const { actor, db } = await loadSalesContext();
    const [month, week, today, follow, staff] = await Promise.all([
      buildSalesReport(db, actor, { kind: "this_month" }),
      buildSalesReport(db, actor, { kind: "this_week" }),
      buildSalesReport(db, actor, { kind: "today" }),
      todayFollowUps(db, actor),
      listStaff(db, actor),
    ]);
    const target = await achievementFor(db, actor, "monthly");
    const activeSales = staff.filter((s) => s.status === "active").length;

    const followCards = await Promise.all(
      follow.rows.slice(0, 8).map(async (f) => {
        try {
          const c = await getCustomer(db, actor, f.customer_id);
          return { f, c };
        } catch {
          return { f, c: null };
        }
      }),
    );

    return (
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
        <ModuleHeader
          icon={Target}
          title={actor.businessName}
          subtitle={`Dashboard KPI modul sales · ${actor.nama} · ${actor.role}`}
        />
        <SalesNav />

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Total sales" value={String(staff.length)} />
          <Kpi label="Active sales" value={String(activeSales)} />
          <Kpi label="Pcs hari ini" value={String(today.totalQty)} />
          <Kpi label="Omzet hari ini" value={fmtRp(today.totalRevenue)} />
          <Kpi label="Pcs minggu ini" value={String(week.totalQty)} />
          <Kpi label="Omzet minggu ini" value={fmtRp(week.totalRevenue)} />
          <Kpi label="Pcs bulan ini" value={String(month.totalQty)} />
          <Kpi label="Omzet bulan ini" value={fmtRp(month.totalRevenue)} />
          <Kpi label="Trx hari ini" value={String(today.totalOrders)} />
          <Kpi label="Trx bulan ini" value={String(month.totalOrders)} />
          <Kpi label="AOV bulan ini" value={fmtRp(month.aov)} />
          <Kpi
            label="Target / achievement"
            value={`${target.sold}/${target.target} · ${target.achievement}%`}
          />
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <div className={MODULE_CARD}>
            <h2 className="mb-3 text-sm font-semibold">Ranking sales</h2>
            {month.ranking.length === 0 ? (
              <p className="text-sm text-[#8B8AA0]">
                {month.servedBy.length
                  ? `Dilayani oleh ${month.servedBy.map((s) => s.nama).join(", ")}`
                  : "Belum ada penjualan paid bulan ini."}
              </p>
            ) : (
              <>
                <ol className="space-y-2">
                  {month.ranking.map((s, i) => (
                    <li key={s.salesId} className="flex justify-between text-sm">
                      <span>
                        {i + 1}. {s.nama}
                      </span>
                      <span className="font-mono text-[#2DD4BF]">
                        {s.qty} pcs · {fmtRp(s.revenue)}
                      </span>
                    </li>
                  ))}
                </ol>
                {month.servedBy.length > 0 && (
                  <p className="mt-3 text-sm text-[#8B8AA0]">
                    Dilayani oleh {month.servedBy.map((s) => s.nama).join(", ")}
                  </p>
                )}
              </>
            )}
          </div>
          <div className={MODULE_CARD}>
            <h2 className="mb-3 text-sm font-semibold">Follow up hari ini</h2>
            {followCards.length === 0 ? (
              <p className="text-sm text-[#8B8AA0]">Tidak ada follow-up hari ini.</p>
            ) : (
              <ul className="space-y-3">
                {followCards.map(({ f, c }) => (
                  <li key={f.id} className="text-sm">
                    <p className="font-medium">{c?.nama || "Customer"}</p>
                    <p className="text-[11px] text-[#8B8AA0]">
                      Pembelian terakhir: {c?.last_purchase_at || "—"}
                    </p>
                    <Link href={`/dashboard/sales/customers/${f.customer_id}`} className="text-[11px] text-[#2DD4BF]">
                      DETAIL
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  });
}
