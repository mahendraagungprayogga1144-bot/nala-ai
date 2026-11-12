import { NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/auth/app-url";
import { salesDb } from "@/lib/henima-sales/db";
import {
  ownerBotConfigured,
  ownerBotSecretOk,
  ownerChatIdsFromEnv,
  ownerSendMessage,
  ownerSetWebhook,
} from "@/lib/henima-tracking/owner-bot";
import { resolveOwnerChatAllowlist } from "@/lib/henima-tracking/owner-telegram";
import { runOwnerFieldAlertsJob } from "@/lib/henima-tracking/silent-watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Tes kirim + opsional pasang webhook / sweep lapangan sekarang.
 * Header: x-owner-bot-secret = HENIMA_OWNER_BOT_SECRET
 * Body: { "setWebhook"?: true, "sweep"?: true }
 */
export async function POST(request: Request) {
  if (!ownerBotConfigured()) {
    return NextResponse.json({ ok: false, error: "HENIMA_OWNER_BOT_TOKEN missing" }, { status: 503 });
  }
  const secretHeader = request.headers.get("x-owner-bot-secret");
  if (!ownerBotSecretOk(secretHeader)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.HENIMA_OWNER_BOT_SECRET?.trim() || "";
  const body = (await request.json().catch(() => ({}))) as {
    setWebhook?: boolean;
    sweep?: boolean;
    url?: string;
  };
  let webhookUrl: string | null = null;
  if (body.setWebhook) {
    webhookUrl =
      typeof body.url === "string" && body.url.startsWith("https://")
        ? body.url
        : `${getAppOrigin()}/api/henima-owner-bot/webhook`;
    await ownerSetWebhook(webhookUrl, secret);
  }

  const db = salesDb();
  let sweepResult: unknown = null;
  if (body.sweep) {
    sweepResult = await runOwnerFieldAlertsJob(db);
  }

  const chats = ownerChatIdsFromEnv().length
    ? ownerChatIdsFromEnv()
    : await resolveOwnerChatAllowlist(db);
  if (!chats.length) {
    return NextResponse.json(
      { ok: false, error: "No owner chat ids", webhookUrl, sweepResult },
      { status: 400 },
    );
  }

  const text = [
    "HRD Henima — tes koneksi",
    webhookUrl
      ? "Webhook terpasang. Coba ketik /status atau status di chat ini."
      : body.sweep
        ? "Sweep lapangan dijalankan. Cek alert Senyap/Offline di atas/bawah pesan ini."
        : "Kalau kamu baca ini, bot asisten owner sudah nyambung di production.",
    new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB",
  ].join("\n");

  const sent: number[] = [];
  const failed: { chatId: number; error: string }[] = [];
  for (const chatId of chats) {
    try {
      await ownerSendMessage(chatId, text);
      sent.push(chatId);
    } catch (err) {
      failed.push({
        chatId,
        error: err instanceof Error ? err.message : "send_failed",
      });
    }
  }

  return NextResponse.json({
    ok: sent.length > 0,
    sent,
    failed,
    webhookUrl,
    sweepResult,
    hint: failed.length
      ? "Buka bot di Telegram lalu /start dulu, baru tes lagi."
      : body.sweep
        ? "Sweep selesai. Cek chat HRD untuk alert Senyap/Offline."
        : webhookUrl
          ? "Webhook siap. Ketik /status di bot HRD."
          : "Cek inbox Telegram kamu.",
  });
}
