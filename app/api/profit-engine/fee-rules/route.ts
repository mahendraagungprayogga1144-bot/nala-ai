import { listFeeRules, upsertFeeRule } from "@/lib/gercep-profit/service";
import { readJson, withProfitActor } from "@/lib/gercep-profit/http";

export async function GET() {
  return withProfitActor(async ({ actor, db }) => ({ fee_rules: await listFeeRules(db, actor) }));
}

export async function POST(request: Request) {
  return withProfitActor(async ({ actor, db }) => {
    const body = await readJson(request);
    const rule = await upsertFeeRule(db, actor, body);
    return { ok: true, rule, note: "Rule lama ditutup (effective_until), rule baru dibuat. Order historis tetap memakai rule pada tanggal order." };
  });
}
