import { withSalesActor, readJson } from "@/lib/henima-sales/http";
import { createStaff, ensureDefaultProducts, listStaff, rotateInvite } from "@/lib/henima-sales/staff-service";
import { listProducts } from "@/lib/henima-sales/staff-service";
import type { SalesRole } from "@/lib/henima-sales/types";

export async function GET() {
  return withSalesActor(async ({ actor, db }) => {
    const [staff, products] = await Promise.all([listStaff(db, actor), listProducts(db, actor.businessId)]);
    return { staff, products, actor };
  });
}

export async function POST(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const body = await readJson(request);
    if (body.action === "seed_products") return { products: await ensureDefaultProducts(db, actor) };
    if (body.action === "rotate_invite") return rotateInvite(db, actor, String(body.staffId));
    return createStaff(db, actor, {
      nama: String(body.nama),
      role: body.role as SalesRole,
      leaderId: body.leaderId || null,
      telepon: body.telepon || null,
    });
  });
}
