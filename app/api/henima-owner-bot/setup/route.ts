import { withSalesActor, readJson } from "@/lib/henima-sales/http";
import { getAppOrigin } from "@/lib/auth/app-url";
import { ForbiddenError, SalesError } from "@/lib/henima-sales/types";
import { ownerBotConfigured, ownerSetWebhook } from "@/lib/henima-tracking/owner-bot";

export async function POST(request: Request) {
  return withSalesActor(async ({ actor }) => {
    if (actor.role !== "FOUNDER") throw new ForbiddenError();
    if (!ownerBotConfigured()) {
      throw new SalesError("HENIMA_OWNER_BOT_TOKEN belum diset.", "no_owner_bot", 503);
    }
    const secret = process.env.HENIMA_OWNER_BOT_SECRET?.trim();
    if (!secret) {
      throw new SalesError("HENIMA_OWNER_BOT_SECRET belum diset.", "no_owner_secret", 503);
    }
    const body = await readJson(request).catch(() => ({}));
    const origin =
      typeof body.url === "string" && body.url.startsWith("https://")
        ? body.url
        : `${getAppOrigin()}/api/henima-owner-bot/webhook`;
    await ownerSetWebhook(origin, secret);
    return { ok: true, url: origin };
  });
}
