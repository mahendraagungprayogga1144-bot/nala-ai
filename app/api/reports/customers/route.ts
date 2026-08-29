import { withSalesActor, queryParam } from "@/lib/henima-sales/http";
import { listCustomers } from "@/lib/henima-sales/customer-service";

export async function GET(request: Request) {
  return withSalesActor(async ({ actor, db }) =>
    listCustomers(db, actor, {
      q: queryParam(request, "q"),
      status: queryParam(request, "status"),
      salesId: queryParam(request, "salesId"),
      page: Number(queryParam(request, "page") || 1),
      pageSize: Number(queryParam(request, "pageSize") || 20),
    }),
  );
}
