import { withSalesActor } from "@/lib/henima-sales/http";
import { listProducts } from "@/lib/henima-sales/staff-service";

export async function GET() {
  return withSalesActor(async ({ actor, db }) => ({ products: await listProducts(db, actor.businessId) }));
}
