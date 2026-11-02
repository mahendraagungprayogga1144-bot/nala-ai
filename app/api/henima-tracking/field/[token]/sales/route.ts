import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { NotFoundError, SalesError, normalizePaymentMethod, type PaymentStatus } from "@/lib/henima-sales/types";
import {
  createFieldSale,
  deleteFieldSale,
  fieldSalesDb,
  markFieldPayment,
  updateFieldSale,
} from "@/lib/henima-tracking/field-sales";
import { resolveTrackingToken } from "@/lib/henima-tracking/service";

export const runtime = "nodejs";

const BUCKET = "henima-tracking";

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const db = fieldSalesDb();
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new SalesError("File bukti wajib.", "proof_required");
      const type = file.type || "image/jpeg";
      if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(type)) {
        throw new SalesError("Bukti harus JPG, PNG, atau WEBP.", "proof_type");
      }
      if (file.size > 5 * 1024 * 1024) throw new SalesError("Bukti maksimal 5MB.", "proof_size");
      const { link, staff } = await resolveTrackingToken(db, token);
      const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
      const path = `${link.business_id}/${staff.id}/bukti/${randomUUID()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error } = await db.storage.from(BUCKET).upload(path, buffer, { contentType: type, upsert: false });
      if (error) throw new SalesError(error.message || "Upload bukti gagal.", "proof_upload", 500);
      return NextResponse.json({ path });
    }

    const body = await request.json();
    if (body?.action === "mark_payment") {
      const status = String(body.paymentStatus || "").toUpperCase() as PaymentStatus;
      if (!["PAID", "PENDING", "CANCELLED"].includes(status)) {
        throw new SalesError("Status pembayaran tidak valid.", "payment_status");
      }
      const method = normalizePaymentMethod(body.paymentMethod) || undefined;
      const result = await markFieldPayment(db, token, {
        orderId: String(body.orderId || ""),
        paymentStatus: status,
        paymentMethod: method || undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined,
      });
      return NextResponse.json(result);
    }

    if (body?.action === "edit_sale") {
      const method = normalizePaymentMethod(body.paymentMethod) || undefined;
      const statusRaw = body.paymentStatus != null ? String(body.paymentStatus).toUpperCase() : "";
      const status = statusRaw ? (statusRaw as PaymentStatus) : undefined;
      if (status && !["PAID", "PENDING", "CANCELLED"].includes(status)) {
        throw new SalesError("Status pembayaran tidak valid.", "payment_status");
      }
      const result = await updateFieldSale(db, token, {
        orderId: String(body.orderId || ""),
        productId: typeof body.productId === "string" ? body.productId : undefined,
        quantity: body.quantity != null ? Number(body.quantity) : undefined,
        unitPrice: body.unitPrice != null ? Number(body.unitPrice) : undefined,
        paymentMethod: method,
        paymentStatus: status,
        notes: typeof body.notes === "string" ? body.notes : body.notes === null ? null : undefined,
      });
      return NextResponse.json(result);
    }

    if (body?.action === "delete_sale") {
      const result = await deleteFieldSale(db, token, String(body.orderId || ""));
      return NextResponse.json(result);
    }

    const method = normalizePaymentMethod(body.paymentMethod);
    if (!method) throw new SalesError("Metode pembayaran wajib (tunai/transfer/QRIS).", "payment_method");
    const status = String(body.paymentStatus || "PENDING").toUpperCase() as PaymentStatus;
    if (!["PAID", "PENDING"].includes(status)) throw new SalesError("Status harus lunas atau belum lunas.", "payment_status");

    const result = await createFieldSale(db, token, {
      productId: String(body.productId || ""),
      quantity: Number(body.quantity),
      unitPrice: Number(body.unitPrice),
      customerName: String(body.customerName || ""),
      customerPhone: typeof body.customerPhone === "string" ? body.customerPhone : undefined,
      paymentMethod: method,
      paymentStatus: status,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      proofPath: typeof body.proofPath === "string" ? body.proofPath : null,
      idempotencyKey: String(body.idempotencyKey || randomUUID()),
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof SalesError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.httpStatus });
    }
    console.error("[field-sales]", err);
    return NextResponse.json({ error: "Gagal menyimpan transaksi." }, { status: 500 });
  }
}
