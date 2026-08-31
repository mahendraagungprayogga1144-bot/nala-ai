import { after, NextResponse } from "next/server";
import { salesDb } from "@/lib/henima-sales/db";
import { handleTelegramUpdate, verifyTelegramSecret } from "@/lib/henima-sales/telegram/handler";
import { salesLog, salesLogError } from "@/lib/henima-sales/log";
import { telegramConfigured } from "@/lib/henima-sales/telegram/api";

export const maxDuration = 30;

export async function POST(request: Request) {
  if (!telegramConfigured()) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 503 });
  }
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!verifyTelegramSecret(secret)) {
    salesLog("telegram_unauthorized", { hasHeader: Boolean(secret) });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let update: { update_id?: number };
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!update?.update_id) return NextResponse.json({ ok: true });
  after(async () => {
    try {
      await handleTelegramUpdate(salesDb(), update as Parameters<typeof handleTelegramUpdate>[1]);
    } catch (err) {
      salesLogError("telegram_webhook", err, { update_id: update.update_id });
    }
  });
  return NextResponse.json({ ok: true });
}
