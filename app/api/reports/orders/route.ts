import { withSalesActor, queryParam } from "@/lib/henima-sales/http";
import { listOrders } from "@/lib/henima-sales/order-service";

export async function GET(request: Request) {
  return withSalesActor(async ({ actor, db }) =>
    listOrders(db, actor, {
      from: queryParam(request, "from"),
      to: queryParam(request, "to"),
      salesId: queryParam(request, "salesId"),
      page: Number(queryParam(request, "page") || 1),
      pageSize: Number(queryParam(request, "pageSize") || 20),
    }),
  );
}
