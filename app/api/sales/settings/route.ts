import { withSalesActor, readJson } from "@/lib/henima-sales/http";
import { getSalesSettings, upsertSalesSettings } from "@/lib/henima-sales/settings-service";

export async function GET() {
  return withSalesActor(async ({ actor, db }) => {
    const settings = await getSalesSettings(db, actor.businessId, actor.businessName);
    return {
      actor,
      settings: {
        displayName: settings.displayName,
        tagline: settings.tagline,
      },
    };
  });
}

export async function POST(request: Request) {
  return withSalesActor(async ({ actor, db }) => {
    const body = await readJson(request);
    const saved = await upsertSalesSettings(db, actor, {
      displayName: String(body.displayName || body.display_name || ""),
      tagline: body.tagline ?? null,
    });
    return { ok: true, settings: saved, businessName: saved.display_name };
  });
}
