import { createOrder, listOrders } from "@/lib/gercep-profit/service";
import { readJson, withProfitActor } from "@/lib/gercep-profit/http";

export async function GET() {
  return withProfitActor(async ({ actor, db }) => ({ orders: await listOrders(db, actor) }));
}

export async function POST(request: Request) {
  return withProfitActor(async ({ actor, db }) => {
    const body = await readJson(request);
    const order = await createOrder(db, actor, body);
    return { ok: true, order };
  });
}
