import { withSalesActor, queryParam, readJson } from "@/lib/henima-sales/http";
import { listOrders, confirmSale } from "@/lib/henima-sales/order-service";
import { randomUUID } from "crypto";
import type { PaymentMethod, PaymentStatus } from "@/lib/henima-sales/types";

export async function GET(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    return listOrders(db, actor, {
      from: queryParam(request, "from"),
      to: queryParam(request, "to"),
      salesId: queryParam(request, "salesId"),
      productId: queryParam(request, "productId"),
      payment: queryParam(request, "payment"),
      status: queryParam(request, "status"),
      customerId: queryParam(request, "customerId"),
      includeDeleted: queryParam(request, "includeDeleted") === "1",
      page: Number(queryParam(request, "page") || 1),
      pageSize: Number(queryParam(request, "pageSize") || 20),
    });
  });
}

export async function POST(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const body = await readJson(request);
    return confirmSale(db, actor, {
      customerId: String(body.customerId),
      productId: String(body.productId || body.lines?.[0]?.productId || ""),
      productName: String(body.productName || ""),
      quantity: Number(body.quantity || 0),
      unitPrice: Number(body.unitPrice || 0),
      discount: Number(body.discount || 0),
      paymentMethod: body.paymentMethod as PaymentMethod,
      paymentStatus: (body.paymentStatus || "PAID") as PaymentStatus,
      notes: body.notes || null,
      orderDate: body.orderDate,
      idempotencyKey: String(body.idempotencyKey || randomUUID()),
      lines: Array.isArray(body.lines) ? body.lines : undefined,
    });
  });
}
