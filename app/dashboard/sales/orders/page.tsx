import { Receipt } from "lucide-react";
import ModuleHeader from "../../components/module-header";
import { guardPage } from "../../lib/page-guard";
import SalesNav from "../sales-nav";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { listOrders } from "@/lib/henima-sales/order-service";
import OrdersClient from "./orders-client";

export default function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; payment?: string; status?: string }>;
}) {
  return guardPage("Orders", async () => {
    const params = await searchParams;
    const { actor, db } = await loadSalesContext();
    const { rows } = await listOrders(db, actor, {
      from: params.from,
      to: params.to,
      payment: params.payment,
      status: params.status,
      pageSize: 40,
    });
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
        <ModuleHeader icon={Receipt} title="Orders" subtitle="Transaksi sales Henima" />
        <SalesNav />
        <OrdersClient rows={rows} />
      </div>
    );
  });
}
