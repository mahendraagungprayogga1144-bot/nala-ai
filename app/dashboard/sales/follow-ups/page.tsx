import { MessageCircle } from "lucide-react";
import Link from "next/link";
import ModuleHeader from "../../components/module-header";
import { MODULE_CARD } from "../../components/module-form-styles";
import { guardPage } from "../../lib/page-guard";
import SalesNav from "../sales-nav";
import FollowUpActions from "./followup-actions";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { listFollowUps } from "@/lib/henima-sales/followup-service";
import { getCustomer } from "@/lib/henima-sales/customer-service";
import { listStaff } from "@/lib/henima-sales/staff-service";
import { fmtDateLongId } from "@/lib/henima-sales/money";

export default function FollowUpsPage() {
  return guardPage("Follow Ups", async () => {
    const { actor, db } = await loadSalesContext();
    const [{ rows }, staff] = await Promise.all([listFollowUps(db, actor, { pageSize: 50 }), listStaff(db, actor)]);
    const withCust = await Promise.all(
      rows.map(async (f) => {
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
        <ModuleHeader icon={MessageCircle} title="Follow Ups" subtitle="Reminder CRM harian" />
        <SalesNav />
        <div className="space-y-2">
          {withCust.map(({ f, c }) => (
            <div key={f.id} className={MODULE_CARD}>
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium">{c?.nama || "Customer"}</p>
                  <p className="text-[11px] text-[#8B8AA0]">
                    Sales: {staff.find((s) => s.id === f.sales_id)?.nama || "—"} · Last: {fmtDateLongId(c?.last_purchase_at)} · Next:{" "}
                    {fmtDateLongId(f.scheduled_at)} · {f.status}
                  </p>
                  {f.notes && <p className="mt-1 text-xs">{f.notes}</p>}
                </div>
                <Link href={`/dashboard/sales/customers/${f.customer_id}`} className="text-xs text-[#2DD4BF]">
                  DETAIL
                </Link>
              </div>
              <FollowUpActions id={f.id} />
            </div>
          ))}
        </div>
      </div>
    );
  });
}
