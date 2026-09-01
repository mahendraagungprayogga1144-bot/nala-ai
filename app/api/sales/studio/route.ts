import { withSalesActor, queryParam, readJson } from "@/lib/henima-sales/http";
import { SalesError, STUDIO_MAX_BYTES } from "@/lib/henima-sales/types";
import {
  applyStudioToProduct,
  createStudioEdit,
  deleteStudioAsset,
  listStudioAssets,
} from "@/lib/henima-sales/studio-service";
import { listProducts } from "@/lib/henima-sales/staff-service";

export const maxDuration = 60;

export async function GET(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const studio = await listStudioAssets(db, actor, {
      productId: queryParam(request, "productId"),
      page: Number(queryParam(request, "page") || 1),
    });
    const products = await listProducts(db, actor.businessId);
    return { ...studio, products };
  });
}

export async function POST(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const ctype = request.headers.get("content-type") || "";
    if (ctype.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const sourceId = String(form.get("source_id") || "").trim() || null;
      let bytes: Uint8Array | undefined;
      let mime: string | undefined;
      let filename: string | undefined;
      if (file instanceof File && file.size > 0) {
        if (file.size > STUDIO_MAX_BYTES) {
          throw new SalesError("Ukuran foto terlalu besar (maks 8MB).", "file_size");
        }
        bytes = new Uint8Array(await file.arrayBuffer());
        mime = file.type || "image/jpeg";
        filename = file.name || "foto.jpg";
      }
      return createStudioEdit(db, actor, {
        bytes,
        mime,
        filename,
        sourceId,
        presetRaw: String(form.get("preset") || ""),
        prompt: String(form.get("prompt") || "") || null,
        frameRaw: String(form.get("frame") || "square"),
        productId: String(form.get("product_id") || "") || null,
        productName: String(form.get("product_name") || "") || null,
      });
    }

    const body = await readJson(request);
    const action = String(body.action || "");
    if (action === "apply") {
      return applyStudioToProduct(db, actor, String(body.id || ""), String(body.product_id || ""));
    }
    if (action === "delete") {
      return deleteStudioAsset(db, actor, String(body.id || ""));
    }
    throw new SalesError("Aksi tidak dikenal.", "invalid_action");
  });
}
