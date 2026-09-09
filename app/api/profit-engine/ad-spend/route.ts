import { upsertAdSpend } from "@/lib/gercep-profit/service";
import { readJson, withProfitActor } from "@/lib/gercep-profit/http";

export async function GET() {
  return withProfitActor(async ({ actor, db }) => {
    const { data, error } = await db
      .from("gpe_ad_spend")
      .select("*")
      .eq("business_id", actor.businessId)
      .order("spend_date", { ascending: false })
      .limit(200);
    if (error) return { ad_spend: [] };
    return { ad_spend: data || [] };
  });
}

export async function POST(request: Request) {
  return withProfitActor(async ({ actor, db }) => {
    const body = await readJson(request);
    const row = await upsertAdSpend(db, actor, body);
    return { ok: true, ad_spend: row };
  });
}
