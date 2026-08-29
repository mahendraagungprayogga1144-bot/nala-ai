import { withSalesActor, readJson } from "@/lib/henima-sales/http";
import { listProducts, upsertSalesProduct } from "@/lib/henima-sales/staff-service";

export async function GET() {
  return withSalesActor(async ({ actor, db }) => ({ products: await listProducts(db, actor.businessId) }));
}

export async function POST(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const body = await readJson(request);
    const product = await upsertSalesProduct(db, actor, {
      id: body.id || null,
      name: String(body.name || ""),
      price: Number(body.price),
      stock: body.stock == null || body.stock === "" ? 0 : Number(body.stock),
      unit: body.unit || "pcs",
    });
    const products = await listProducts(db, actor.businessId);
    return { ok: true, product, products };
  });
}
