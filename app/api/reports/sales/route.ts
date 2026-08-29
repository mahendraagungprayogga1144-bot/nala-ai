import { withSalesActor, queryParam } from "@/lib/henima-sales/http";
import { buildSalesReport, type RankMetric, type ReportKind } from "@/lib/henima-sales/report-service";

export async function GET(request: Request) {
  return withSalesActor(async ({ actor, db }) =>
    buildSalesReport(db, actor, {
      kind: (queryParam(request, "kind") || "this_month") as ReportKind,
      from: queryParam(request, "from"),
      to: queryParam(request, "to"),
      salesId: queryParam(request, "salesId"),
      productId: queryParam(request, "productId"),
      payment: queryParam(request, "payment"),
      rankBy: (queryParam(request, "rankBy") || "quantity") as RankMetric,
    }),
  );
}
