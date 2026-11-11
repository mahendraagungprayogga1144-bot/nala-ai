import { Package } from "lucide-react";
import ModuleHeader from "../../components/module-header";
import { guardPage } from "../../lib/page-guard";
import SalesNav from "../sales-nav";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { listHandStock, listStockIssues } from "@/lib/henima-sales/hand-stock-service";
import { listProducts, listStaff } from "@/lib/henima-sales/staff-service";
import StockClient from "./stock-client";

export default function SalesStockPage() {
  return guardPage("Stok Gudang", async () => {
    const { actor, db } = await loadSalesContext();
    const [hand, issues, products, staff] = await Promise.all([
      listHandStock(db, actor).catch(() => []),
      actor.role === "SALES" ? Promise.resolve([]) : listStockIssues(db, actor).catch(() => []),
      listProducts(db, actor.businessId),
      listStaff(db, actor),
    ]);
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
        <ModuleHeader
          icon={Package}
          title="Stok Gudang & Sales"
          subtitle="Ambil dari gudang → stok di tangan sales → otomatis berkurang saat jual"
        />
        <SalesNav />
        <StockClient
          canEdit={actor.role !== "SALES"}
          hand={hand}
          issues={issues}
          products={products.map((p) => ({ id: p.id, name: p.name, stock: p.stock ?? 0 }))}
          staff={staff
            .filter((s) => s.role === "SALES" || s.role === "LEADER")
            .filter((s) => s.status === "active" || s.status === "pending")
            .map((s) => ({ id: s.id, nama: s.nama }))}
        />
      </div>
    );
  });
}
