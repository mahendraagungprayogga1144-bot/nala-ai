import { withSalesActor, queryParam, readJson } from "@/lib/henima-sales/http";
import { listCommissionLedger, listCommissionRules, upsertCommissionRule } from "@/lib/henima-sales/commission-service";
import type { SalesRole } from "@/lib/henima-sales/types";

export async function GET(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const ledger = await listCommissionLedger(db, actor, {
      from: queryParam(request, "from"),
      to: queryParam(request, "to"),
      salesId: queryParam(request, "salesId"),
    });
    const rules = actor.role === "SALES" ? [] : await listCommissionRules(db, actor);
    return { ...ledger, rules };
  });
}

export async function POST(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const body = await readJson(request);
    return upsertCommissionRule(db, actor, {
      id: body.id,
      salesId: body.salesId || null,
      role: (body.role || null) as SalesRole | null,
      productId: body.productId || null,
      fixedAmount: Number(body.fixedAmount || 0),
      percentage: Number(body.percentage || 0),
      effectiveFrom: String(body.effectiveFrom),
      effectiveTo: body.effectiveTo || null,
      active: body.active !== false,
    });
  });
}
