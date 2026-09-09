import { listCampaigns, upsertCampaign } from "@/lib/gercep-profit/service";
import { readJson, withProfitActor } from "@/lib/gercep-profit/http";

export async function GET() {
  return withProfitActor(async ({ actor, db }) => ({ campaigns: await listCampaigns(db, actor) }));
}

export async function POST(request: Request) {
  return withProfitActor(async ({ actor, db }) => {
    const body = await readJson(request);
    const campaign = await upsertCampaign(db, actor, body);
    return { ok: true, campaign };
  });
}
