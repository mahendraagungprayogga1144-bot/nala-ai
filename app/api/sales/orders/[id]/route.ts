import { withSalesActor, readJson } from "@/lib/henima-sales/http";
import { getOrder, softDeleteOrder, updateOrder } from "@/lib/henima-sales/order-service";
import type { PaymentMethod, PaymentStatus } from "@/lib/henima-sales/types";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withSalesActor(async ({ actor, db }) => getOrder(db, actor, id, { includeDeleted: actor.role === "FOUNDER" }));
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withSalesActor(async ({ actor, db }) => {
    const body = await readJson(request);
    return updateOrder(db, actor, id, {
      quantity: body.quantity != null ? Number(body.quantity) : undefined,
      unitPrice: body.unitPrice != null ? Number(body.unitPrice) : undefined,
      discount: body.discount != null ? Number(body.discount) : undefined,
      paymentMethod: body.paymentMethod as PaymentMethod | undefined,
      paymentStatus: body.paymentStatus as PaymentStatus | undefined,
      notes: body.notes,
      productId: body.productId,
      productName: body.productName,
    });
  });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withSalesActor(async ({ actor, db }) => softDeleteOrder(db, actor, id));
}
