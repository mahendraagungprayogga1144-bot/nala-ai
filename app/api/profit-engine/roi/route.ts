import { getProfitability } from "@/lib/gercep-profit/service";
import { withProfitActor } from "@/lib/gercep-profit/http";

export async function GET() {
  return withProfitActor(async ({ actor, db }) => {
    const data = await getProfitability(db, actor);
    return {
      business_roi: data.totals.business_roi,
      ad_roi: data.totals.ad_roi,
      invested_capital: data.totals.invested_capital,
      net_profit: data.totals.net_profit,
      campaigns: data.campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        business_roi: c.result.business_roi,
        ad_roi: c.result.ad_roi,
      })),
    };
  });
}
