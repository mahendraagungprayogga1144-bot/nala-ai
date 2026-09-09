import { getProfitability } from "@/lib/gercep-profit/service";
import { withProfitActor } from "@/lib/gercep-profit/http";

export async function GET() {
  return withProfitActor(async ({ actor, db }) => {
    const data = await getProfitability(db, actor);
    const recommendations = data.campaigns.map((c) => ({
      id: c.id,
      campaign: c.name,
      product: c.product_name,
      roas: c.result.advertising.roas,
      be_roas: c.result.be_roas,
      target_roas: c.result.target_roas,
      net_profit: c.result.net_profit,
      contribution_profit: c.result.contribution_profit,
      status: c.result.decision.status,
      label: c.result.decision.label,
      message: c.result.decision.message,
      recommendation: c.result.decision.recommendation,
    }));
    return { recommendations, totals: data.totals.decision };
  });
}
