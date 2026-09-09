import { listProducts, upsertProduct } from "@/lib/gercep-profit/service";
import { readJson, withProfitActor } from "@/lib/gercep-profit/http";

export async function GET() {
  return withProfitActor(async ({ actor, db }) => ({ products: await listProducts(db, actor) }));
}

export async function POST(request: Request) {
  return withProfitActor(async ({ actor, db }) => {
    const body = await readJson(request);
    const product = await upsertProduct(db, actor, body);
    return { ok: true, product };
  });
}
