import { withSalesActor, readJson, queryParam } from "@/lib/henima-sales/http";
import {
  issueStockToSales,
  listHandStock,
  listStockIssues,
  returnStockFromSales,
} from "@/lib/henima-sales/hand-stock-service";
import { listProducts, listStaff } from "@/lib/henima-sales/staff-service";
import { SalesError } from "@/lib/henima-sales/types";

export async function GET(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const salesId = queryParam(request, "salesId");
    const [hand, issues, products, staff] = await Promise.all([
      listHandStock(db, actor, salesId),
      actor.role === "SALES" ? Promise.resolve([]) : listStockIssues(db, actor),
      listProducts(db, actor.businessId),
      listStaff(db, actor),
    ]);
    return {
      hand,
      issues,
      products: products.map((p) => ({ id: p.id, name: p.name, stock: p.stock ?? 0 })),
      staff: staff
        .filter((s) => s.role === "SALES" || s.role === "LEADER")
        .filter((s) => s.status === "active" || s.status === "pending")
        .map((s) => ({ id: s.id, nama: s.nama, role: s.role })),
    };
  });
}

export async function POST(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const body = await readJson(request);
    const action = String(body.action || "issue");
    const salesId = String(body.salesId || "");
    const productId = String(body.productId || "");
    const qty = Number(body.qty);
    const note = body.note == null ? null : String(body.note);

    if (!salesId || !productId) throw new SalesError("Sales dan produk wajib.", "invalid");

    const result =
      action === "return"
        ? await returnStockFromSales(db, actor, { salesId, productId, qty, note })
        : await issueStockToSales(db, actor, { salesId, productId, qty, note });

    const [hand, issues] = await Promise.all([
      listHandStock(db, actor),
      listStockIssues(db, actor),
    ]);
    return { ok: true, result, hand, issues };
  });
}
