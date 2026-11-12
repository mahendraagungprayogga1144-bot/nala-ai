import { NextResponse } from "next/server";
import { salesDb } from "@/lib/henima-sales/db";
import {
  ownerBotConfigured,
  ownerBotSecretOk,
  ownerChatIdsFromEnv,
  ownerSendMessage,
} from "@/lib/henima-tracking/owner-bot";
import { resolveOwnerChatAllowlist } from "@/lib/henima-tracking/owner-telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tes kirim 1 pesan HRD. Header: x-owner-bot-secret = HENIMA_OWNER_BOT_SECRET */
export async function POST(request: Request) {
  if (!ownerBotConfigured()) {
    return NextResponse.json({ ok: false, error: "HENIMA_OWNER_BOT_TOKEN missing" }, { status: 503 });
  }
  const secret = request.headers.get("x-owner-bot-secret");
  if (!ownerBotSecretOk(secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = salesDb();
  const chats = ownerChatIdsFromEnv().length
    ? ownerChatIdsFromEnv()
    : await resolveOwnerChatAllowlist(db);
  if (!chats.length) {
    return NextResponse.json({ ok: false, error: "No owner chat ids" }, { status: 400 });
  }

  const text = [
    "HRD Henima — tes koneksi",
    "Kalau kamu baca ini, bot asisten owner sudah nyambung di production.",
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
    hint: failed.length
      ? "Buka bot di Telegram lalu /start dulu, baru tes lagi."
      : "Cek inbox Telegram kamu.",
  });
}
