import { withSalesActor, queryParam } from "@/lib/henima-sales/http";
import { listTestimonials, signedTestimonialUrl } from "@/lib/henima-sales/testimonial-service";

export async function GET(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const res = await listTestimonials(db, actor, {
      salesId: queryParam(request, "salesId"),
      customerId: queryParam(request, "customerId"),
      from: queryParam(request, "from"),
      to: queryParam(request, "to"),
      page: Number(queryParam(request, "page") || 1),
    });
    const rows = await Promise.all(
      res.rows.map(async (t: { storage_path: string }) => ({
        ...t,
        url: await signedTestimonialUrl(db, t.storage_path),
      })),
    );
    return { ...res, rows };
  });
}
