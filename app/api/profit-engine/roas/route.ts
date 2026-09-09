import { getProfitability } from "@/lib/gercep-profit/service";
import { withProfitActor } from "@/lib/gercep-profit/http";

export async function GET() {
  return withProfitActor(async ({ actor, db }) => {
    const data = await getProfitability(db, actor);
    return {
      roas: data.totals.advertising.roas,
      be_roas: data.totals.be_roas,
      target_roas: data.totals.target_roas,
      campaigns: data.campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        roas: c.result.advertising.roas,
        be_roas: c.result.be_roas,
        target_roas: c.result.target_roas,
      })),
    };
  });
}
