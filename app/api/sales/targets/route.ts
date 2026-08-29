import { withSalesActor, queryParam, readJson } from "@/lib/henima-sales/http";
import { achievementFor, listTargets, upsertTarget } from "@/lib/henima-sales/target-service";
import type { TargetPeriod } from "@/lib/henima-sales/types";

export async function GET(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const period = (queryParam(request, "period") || "monthly") as TargetPeriod;
    const salesId = queryParam(request, "salesId");
    const [targets, daily, weekly, monthly] = await Promise.all([
      listTargets(db, actor, salesId),
      achievementFor(db, actor, "daily", salesId),
      achievementFor(db, actor, "weekly", salesId),
      achievementFor(db, actor, "monthly", salesId),
    ]);
    return { targets, daily, weekly, monthly, focus: period };
  });
}

export async function POST(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const body = await readJson(request);
    return upsertTarget(db, actor, {
      salesId: body.salesId || null,
      periodType: body.periodType as TargetPeriod,
      quantityTarget: Number(body.quantityTarget),
      revenueTarget: Number(body.revenueTarget || 0),
      effectiveFrom: String(body.effectiveFrom),
      effectiveTo: body.effectiveTo || null,
    });
  });
}
