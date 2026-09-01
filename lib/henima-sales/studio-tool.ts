import { salesDb } from "./db";
import { resolveActorByUserId } from "./authz";
import { listProducts } from "./staff-service";
import { applyStudioToProduct, createStudioEdit, latestStudioOriginal } from "./studio-service";
import { resolveStudioPreset, studioPresetPublic } from "./studio-presets";
import { studioConfigured, studioProvider } from "./studio-provider";
import { ForbiddenError, SalesError } from "./types";

type ChatCtx = { userId: string; business: { id: string } | null };

export async function runGantiLatarStudio(ctx: ChatCtx, input: Record<string, unknown>) {
  if (!studioConfigured()) {
    return "Studio belum siap. Founder set PHOTOROOM_API_KEY di server (atau REMOVEBG_API_KEY untuk cutout + warna solid).";
  }
  const presetRaw = typeof input.preset === "string" ? input.preset : "";
  const preset = resolveStudioPreset(presetRaw);
  if (!preset) {
    const names = studioPresetPublic()
      .map((p) => p.id)
      .join(", ");
    return `Preset tidak dikenali. Pilih: ${names}.`;
  }
  try {
    const db = salesDb();
    const actor = await resolveActorByUserId(db, ctx.userId, ctx.business?.id);
    const produk = typeof input.produk === "string" ? input.produk.trim() : "";
    const source = await latestStudioOriginal(db, actor, produk || "latest");
    if (!source) {
      return "Belum ada foto botol. Upload dulu di modul Studio Henima, baru minta ganti latar di chat.";
    }
    const prompt = typeof input.prompt === "string" ? input.prompt : null;
    const frame = typeof input.frame === "string" ? input.frame : source.frame;
    const { asset } = await createStudioEdit(db, actor, {
      sourceId: source.id,
      presetRaw: preset,
      prompt,
      frameRaw: frame,
      productId: source.product_id,
      productName: source.product_name || produk || null,
    });
    let extra = "";
    const apply = input.apply_to_catalog === true || input.apply_to_catalog === "true";
    if (apply) {
      const products = await listProducts(db, actor.businessId);
      const hint = (produk || asset.product_name || "").toLowerCase();
      const product =
        products.find((p) => p.id === asset.product_id) ||
        products.find((p) => p.name.toLowerCase() === hint) ||
        products.find((p) => hint && p.name.toLowerCase().includes(hint));
      if (!product) extra = " Katalog tidak diubah (produk tidak ketemu).";
      else {
        try {
          await applyStudioToProduct(db, actor, asset.id, product.id);
          extra = ` Sudah ditempel ke katalog ${product.name}.`;
        } catch (err) {
          extra = ` ${err instanceof Error ? err.message : "Gagal tempel katalog."}`;
        }
      }
    }
    const link = asset.resultUrl ? ` Lihat: ${asset.resultUrl}` : " Buka modul Studio Henima untuk unduh.";
    return `Latar ${preset.replaceAll("_", " ")} siap untuk ${asset.product_name || "foto studio"} via ${studioProvider()}.${extra}${link}`;
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof SalesError) return err.message;
    return err instanceof Error ? err.message : "Gagal ganti latar.";
  }
}
