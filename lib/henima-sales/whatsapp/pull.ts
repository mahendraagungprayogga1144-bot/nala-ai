import type { SalesDb } from "../db";
import { resolveActiveFounder } from "../authz";
import { captureOutbound } from "../telegram/capture";
import { handleTelegramUpdate } from "../telegram/handler";

export function whatsAppUpdateId(messageId: string) {
  let hash = 0;
  for (const char of messageId) hash = Math.imul(hash, 31) + char.charCodeAt(0);
  return 8_000_000_000_000 + (Math.abs(hash) % 1_000_000_000);
}

export async function answerWhatsAppPull(db: SalesDb, text: string, messageId = "") {
  const actor = await resolveActiveFounder(db);
  if (!actor?.telegramUserId) return "Akun founder belum terhubung ke Telegram, jadi WhatsApp belum bisa memakai percakapan yang sama.";
  const updateId = whatsAppUpdateId(messageId || `${text}:${Date.now()}`);
  const lines = await captureOutbound(() =>
    handleTelegramUpdate(db, {
      update_id: updateId,
      message: {
        message_id: updateId,
        chat: { id: actor.telegramUserId! },
        from: { id: actor.telegramUserId!, first_name: actor.nama },
        text,
      },
    }),
  );
  return lines.join("\n\n").slice(0, 3500);
}
