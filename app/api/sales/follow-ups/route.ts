import { withSalesActor, queryParam, readJson } from "@/lib/henima-sales/http";
import { createFollowUp, listFollowUps, todayFollowUps, updateFollowUp } from "@/lib/henima-sales/followup-service";
import type { FollowUpStatus } from "@/lib/henima-sales/types";

export async function GET(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    if (queryParam(request, "today") === "1") return todayFollowUps(db, actor);
    return listFollowUps(db, actor, {
      date: queryParam(request, "date"),
      status: queryParam(request, "status"),
      page: Number(queryParam(request, "page") || 1),
    });
  });
}

export async function POST(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const body = await readJson(request);
    return createFollowUp(db, actor, {
      customerId: String(body.customerId),
      scheduledAt: String(body.scheduledAt),
      notes: body.notes || null,
    });
  });
}

export async function PATCH(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const body = await readJson(request);
    return updateFollowUp(db, actor, String(body.id), {
      status: body.status as FollowUpStatus | undefined,
      notes: body.notes,
      scheduledAt: body.scheduledAt,
    });
  });
}
