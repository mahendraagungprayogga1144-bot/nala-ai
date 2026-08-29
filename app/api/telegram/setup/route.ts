import { withSalesActor, readJson } from "@/lib/henima-sales/http";
import { setWebhook, telegramConfigured } from "@/lib/henima-sales/telegram/api";
import { getAppOrigin } from "@/lib/auth/app-url";
import { ForbiddenError, SalesError } from "@/lib/henima-sales/types";

export async function POST(request: Request) {
  return withSalesActor(async ({ actor }) => {
    if (actor.role !== "FOUNDER") throw new ForbiddenError();
    if (!telegramConfigured()) throw new SalesError("TELEGRAM_BOT_TOKEN belum diset.", "no_token", 503);
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret) throw new SalesError("TELEGRAM_WEBHOOK_SECRET belum diset.", "no_secret", 503);
    const body = await readJson(request).catch(() => ({}));
    const origin = typeof body.url === "string" && body.url.startsWith("https://")
      ? body.url
      : `${getAppOrigin()}/api/telegram/webhook`;
    await setWebhook(origin, secret);
    return { ok: true, url: origin };
  });
}
