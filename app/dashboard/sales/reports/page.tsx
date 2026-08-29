import { BarChart3 } from "lucide-react";
import ModuleHeader from "../../components/module-header";
import { guardPage } from "../../lib/page-guard";
import SalesNav from "../sales-nav";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { buildSalesReport } from "@/lib/henima-sales/report-service";
import ReportsClient from "./reports-client";

export default function ReportsPage() {
  return guardPage("Reports", async () => {
    const { actor, db } = await loadSalesContext();
    const report = await buildSalesReport(db, actor, { kind: "this_month" });
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
        <ModuleHeader icon={BarChart3} title="Reports" subtitle="Filter periode · ranking · PDF" />
        <SalesNav />
        <ReportsClient initial={report} />
      </div>
    );
  });
}
