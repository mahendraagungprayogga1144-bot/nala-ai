import { withSalesActor, queryParam } from "@/lib/henima-sales/http";
import {
  loadOwnerDashboardSummary,
  type DashboardPeriod,
} from "@/lib/henima-tracking/owner-dashboard";

export async function GET(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const raw = (queryParam(request, "period") || "this_month").trim();
    const period: DashboardPeriod = raw === "last_month" ? "last_month" : "this_month";
    const summary = await loadOwnerDashboardSummary(db, actor, period);
    return { period, summary };
  });
}
