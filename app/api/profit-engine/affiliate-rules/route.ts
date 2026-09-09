import { henimaAfternoonInput } from "@/lib/gercep-profit/demo";
import { withProfitActor, readJson } from "@/lib/gercep-profit/http";
import { ProfitEngineError } from "@/lib/gercep-profit/types";

export async function GET() {
  return withProfitActor(async ({ actor, db }) => {
    const { data, error } = await db
      .from("gpe_affiliate_rules")
      .select("*")
      .eq("business_id", actor.businessId)
      .order("effective_from", { ascending: false });
    if (error || !data?.length) {
      return { affiliate_rules: henimaAfternoonInput().affiliate_rules };
    }
    return { affiliate_rules: data };
  });
}

export async function POST(request: Request) {
  return withProfitActor(async ({ actor, db }) => {
    const body = await readJson(request);
    const { data, error } = await db
      .from("gpe_affiliate_rules")
      .insert({
        user_id: actor.userId,
        business_id: actor.businessId,
        affiliate_type: body.affiliate_type || "STANDARD",
        affiliate_name: body.affiliate_name || null,
        affiliate_id: body.affiliate_id || null,
        rate: Number(body.rate || 0),
        calculation_base: body.calculation_base || "NET_REVENUE",
        effective_from: body.effective_from || new Date().toISOString().slice(0, 10),
        effective_until: body.effective_until || null,
        active: body.active !== false,
      })
      .select("*")
      .single();
    if (error) throw new ProfitEngineError(error.message, "invalid_input", 503);
    return { ok: true, rule: data };
  });
}
