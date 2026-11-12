import "server-only";

/**
 * Bot asisten owner (terpisah dari bot sales Henima).
 * Hanya kirim/balas pantauan lapangan — tidak menyentuh FSM sales.
 *
 * Env:
 * - HENIMA_OWNER_BOT_TOKEN
 * - HENIMA_OWNER_BOT_SECRET (webhook)
 * - HENIMA_OWNER_CHAT_IDS (opsional, comma-separated; kalau kosong pakai telegram founder di DB)
 */

const API = "https://api.telegram.org";

export function ownerBotToken() {
  return process.env.HENIMA_OWNER_BOT_TOKEN?.trim() || "";
}

export function ownerBotConfigured() {
  return Boolean(ownerBotToken());
}

export function ownerBotSecretOk(header: string | null) {
  const expected = process.env.HENIMA_OWNER_BOT_SECRET?.trim() || "";
  if (!expected) return false;
  return Boolean(header && header === expected);
}

export function ownerChatIdsFromEnv() {
  const raw = process.env.HENIMA_OWNER_CHAT_IDS?.trim() || "";
  if (!raw) return [] as number[];
  return [
    ...new Set(
      raw
        .split(/[,\s]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
}

async function tg(method: string, body: Record<string, unknown>) {
  const t = ownerBotToken();
  if (!t) throw new Error("HENIMA_OWNER_BOT_TOKEN missing");
  const res = await fetch(`${API}/bot${t}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: unknown };
  if (!json.ok) throw new Error(json.description || "owner_bot_api_error");
  return json.result;
}

export async function ownerSendMessage(chatId: number, text: string) {
  return tg("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4000),
    disable_web_page_preview: true,
  });
}

export async function ownerSetWebhook(url: string, secret: string) {
  return tg("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
}
