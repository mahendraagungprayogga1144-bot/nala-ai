import { Users } from "lucide-react";
import ModuleHeader from "../../components/module-header";
import { guardPage } from "../../lib/page-guard";
import SalesNav from "../sales-nav";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { listCustomers } from "@/lib/henima-sales/customer-service";
import CustomersClient from "./customers-client";

export default function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  return guardPage("Customers", async () => {
    const params = await searchParams;
    const { actor, db } = await loadSalesContext();
    const { rows, total } = await listCustomers(db, actor, { q: params.q, status: params.status, pageSize: 30 });
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
        <ModuleHeader icon={Users} title="Customers" subtitle="CRM pelanggan Henima" />
        <SalesNav />
        <CustomersClient initial={rows} total={total} />
      </div>
    );
  });
}
