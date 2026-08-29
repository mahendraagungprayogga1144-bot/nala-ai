import { Percent } from "lucide-react";
import ModuleHeader from "../../components/module-header";
import { guardPage } from "../../lib/page-guard";
import SalesNav from "../sales-nav";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { listCommissionLedger } from "@/lib/henima-sales/commission-service";
import CommissionsClient from "./commissions-client";

export default function CommissionsPage() {
  return guardPage("Commissions", async () => {
    const { actor, db } = await loadSalesContext();
    const { rows, total } = await listCommissionLedger(db, actor, {});
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
        <ModuleHeader icon={Percent} title="Commissions" subtitle="Dihitung dari aturan aktif pada tanggal transaksi" />
        <SalesNav />
        <CommissionsClient total={total} rows={rows} canEdit={actor.role === "FOUNDER"} />
      </div>
    );
  });
}
