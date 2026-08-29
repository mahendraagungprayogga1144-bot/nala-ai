import { withSalesActor, readJson } from "@/lib/henima-sales/http";
import { getCustomer, updateCustomer } from "@/lib/henima-sales/customer-service";
import { listOrders } from "@/lib/henima-sales/order-service";
import { listFollowUps } from "@/lib/henima-sales/followup-service";
import { listTestimonials, signedTestimonialUrl } from "@/lib/henima-sales/testimonial-service";
import type { CustomerStatus } from "@/lib/henima-sales/types";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withSalesActor(async ({ actor, db }) => {
    const customer = await getCustomer(db, actor, id);
    const [orders, followUps, testimonials] = await Promise.all([
      listOrders(db, actor, { customerId: id, pageSize: 50 }),
      listFollowUps(db, actor, { pageSize: 20 }),
      listTestimonials(db, actor, { customerId: id, pageSize: 12 }),
    ]);
    const photos = await Promise.all(
      testimonials.rows.map(async (t: { storage_path: string; id: string }) => ({
        ...t,
        url: await signedTestimonialUrl(db, t.storage_path),
      })),
    );
    return {
      customer,
      orders: orders.rows,
      followUps: followUps.rows.filter((f) => f.customer_id === id),
      testimonials: photos,
    };
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withSalesActor(async ({ actor, db }) => {
    const body = await readJson(request);
    return updateCustomer(db, actor, id, {
      nama: body.nama,
      phone: body.phone,
      kota: body.kota,
      catatan: body.catatan,
      status: body.status as CustomerStatus | undefined,
      assignedSalesId: body.assignedSalesId,
    });
  });
}
