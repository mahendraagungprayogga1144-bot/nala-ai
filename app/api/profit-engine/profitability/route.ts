import { buildDemoDashboard } from "@/lib/gercep-profit/demo";
import { getProfitability } from "@/lib/gercep-profit/service";
import { queryParam, withProfitActor } from "@/lib/gercep-profit/http";

export async function GET(request: Request) {
  return withProfitActor(async ({ actor, db }) => {
    const data = await getProfitability(db, actor);
    const demo = buildDemoDashboard();
    return {
      ...data,
      daily: "daily" in data ? data.daily : demo.daily,
      roas: data.totals.advertising.roas,
      be_roas: data.totals.be_roas,
      roi: data.totals.business_roi,
      kind: queryParam(request, "kind") || "period",
    };
  });
}
