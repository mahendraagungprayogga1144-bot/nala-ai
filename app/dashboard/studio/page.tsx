import { Camera } from "lucide-react";
import ModuleHeader from "../components/module-header";
import { guardPage } from "../lib/page-guard";
import { loadSalesContext } from "@/lib/henima-sales/page-context";
import { listStudioAssets } from "@/lib/henima-sales/studio-service";
import { listProducts } from "@/lib/henima-sales/staff-service";
import { STUDIO_PRESETS, STUDIO_FRAMES, DEFAULT_SWAP_PROMPT } from "@/lib/henima-sales/studio-presets";
import { geminiConfigured, studioConfigured, studioProvider } from "@/lib/henima-sales/studio-provider";
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
          title="Studio Henima"
          subtitle={`${actor.businessName} — tukar botol ke foto referensi, atau ganti latar`}
          status="beta"
          chatHint="Upload @img1 scene + @img2 botol, lalu tukar botol"
        />
        <StudioClient
          role={actor.role}
          configured={studioConfigured()}
          swapConfigured={geminiConfigured()}
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
          defaultSwapPrompt={DEFAULT_SWAP_PROMPT}
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
