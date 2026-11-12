import "server-only";
import type { SalesDb } from "@/lib/henima-sales/db";
import { ownerBotConfigured, ownerChatIdsFromEnv, ownerSendMessage } from "./owner-bot";

/** Kirim lewat bot asisten owner. Bot sales tidak dipakai. */
export async function notifyFoundersTelegram(db: SalesDb, businessId: string, text: string) {
  if (!ownerBotConfigured()) return { sent: 0, skipped: "no_owner_bot" as const };

  const fromEnv = ownerChatIdsFromEnv();
  let ids = fromEnv;

  if (!ids.length) {
    const { data, error } = await db
      .from("module_sales_staff")
      .select("telegram_user_id")
      .eq("business_id", businessId)
      .eq("role", "FOUNDER")
      .eq("status", "active")
      .not("telegram_user_id", "is", null);
    if (error) return { sent: 0, skipped: "staff_read" as const };
    ids = [
      ...new Set(
        (data || [])
          .map((row: { telegram_user_id: number | null }) => Number(row.telegram_user_id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
  }

  if (!ids.length) return { sent: 0, skipped: "no_owner_chat" as const };

  let sent = 0;
  for (const chatId of ids) {
    try {
      await ownerSendMessage(chatId, text);
      sent += 1;
    } catch {
      /* pantauan jangan gagal karena Telegram */
    }
  }
  return { sent, skipped: null };
}

/** Semua chat yang boleh pakai bot asisten (env + founder aktif). */
export async function resolveOwnerChatAllowlist(db: SalesDb) {
  const fromEnv = ownerChatIdsFromEnv();
  if (fromEnv.length) return fromEnv;
  const { data } = await db
    .from("module_sales_staff")
    .select("telegram_user_id")
    .eq("role", "FOUNDER")
    .eq("status", "active")
    .not("telegram_user_id", "is", null);
  return [
    ...new Set(
      (data || [])
        .map((row: { telegram_user_id: number | null }) => Number(row.telegram_user_id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
}
