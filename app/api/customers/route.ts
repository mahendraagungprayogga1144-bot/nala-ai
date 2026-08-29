import { withSalesActor, queryParam, readJson } from "@/lib/henima-sales/http";
import { createCustomer, listCustomers } from "@/lib/henima-sales/customer-service";

export async function GET(request: Request) {
  return withSalesActor(async ({ actor, db }) =>
    listCustomers(db, actor, {
      q: queryParam(request, "q"),
      status: queryParam(request, "status"),
      salesId: queryParam(request, "salesId"),
      page: Number(queryParam(request, "page") || 1),
      pageSize: Number(queryParam(request, "pageSize") || 20),
    }),
  );
}

export async function POST(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const body = await readJson(request);
    return createCustomer(db, actor, {
      nama: String(body.nama || body.name || ""),
      phone: String(body.phone || body.whatsapp_phone || ""),
      kota: body.kota || body.city || null,
      catatan: body.catatan || body.notes || null,
      assignedSalesId: body.assignedSalesId || null,
    });
  });
}
