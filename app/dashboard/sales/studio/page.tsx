import { Camera } from "lucide-react";
import ModuleHeader from "../../components/module-header";
import { guardPage } from "../../lib/page-guard";
import SalesNav from "../sales-nav";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { listStudioAssets } from "@/lib/henima-sales/studio-service";
import { listProducts } from "@/lib/henima-sales/staff-service";
import { STUDIO_PRESETS, STUDIO_FRAMES } from "@/lib/henima-sales/studio-presets";
import { studioConfigured, studioProvider } from "@/lib/henima-sales/studio-provider";
import StudioClient from "./studio-client";

export default function StudioPage() {
  return guardPage("Henima Studio", async () => {
    const { actor, db } = await loadSalesContext();
    let assets: Awaited<ReturnType<typeof listStudioAssets>>["assets"] = [];
    let tableReady = true;
    try {
      const listed = await listStudioAssets(db, actor, { pageSize: 24 });
      assets = listed.assets;
    } catch {
      tableReady = false;
    }
    const products = await listProducts(db, actor.businessId);
    return (
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
        <ModuleHeader
          icon={Camera}
          title="Studio"
          subtitle={`${actor.businessName} — editor foto produk, ganti latar botol`}
          status="beta"
          chatHint="Bilang di chat: ganti latar Afternoon jadi marble"
        />
        <SalesNav />
        <StudioClient
          role={actor.role}
          configured={studioConfigured()}
          provider={studioProvider()}
          tableReady={tableReady}
          products={products.map((p) => ({ id: p.id, name: p.name }))}
          presets={STUDIO_PRESETS.map(({ id, label, hint, swatch, kind }) => ({
            id,
            label,
            hint,
            swatch,
            kind,
          }))}
          frames={STUDIO_FRAMES.map(({ id, label }) => ({ id, label }))}
          assets={assets.map((a) => ({
            id: a.id,
            product_id: a.product_id,
            product_name: a.product_name,
            preset: a.preset,
            frame: a.frame,
            originalUrl: a.originalUrl,
            resultUrl: a.resultUrl,
            created_at: a.created_at,
          }))}
        />
      </div>
    );
  });
}
