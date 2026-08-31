const API = "https://api.telegram.org";

function token() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

export function telegramConfigured() {
  return Boolean(token());
}

async function tg(method: string, body: Record<string, unknown>) {
  const t = token();
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN missing");
  const res = await fetch(`${API}/bot${t}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: unknown };
  if (!json.ok) throw new Error(json.description || "telegram_api_error");
  return json.result;
}

export async function sendChatAction(chatId: number, action: "typing" | "upload_document" = "typing") {
  try {
    await tg("sendChatAction", { chat_id: chatId, action });
  } catch {
    /* ignore */
  }
}

export async function sendMessage(
  chatId: number,
  text: string,
  keyboard?: { text: string; data: string }[][],
) {
  return tg("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4000),
    reply_markup: keyboard
      ? { inline_keyboard: keyboard.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))) }
      : undefined,
  });
}

export async function answerCallback(id: string) {
  try {
    await tg("answerCallbackQuery", { callback_query_id: id });
  } catch {
    /* ignore expired */
  }
}

export async function sendDocument(chatId: number, filename: string, bytes: Uint8Array, caption?: string) {
  const t = token();
  const form = new FormData();
  form.set("chat_id", String(chatId));
  if (caption) form.set("caption", caption.slice(0, 1000));
  form.set("document", new Blob([Buffer.from(bytes)], { type: "application/pdf" }), filename);
  const res = await fetch(`${API}/bot${t}/sendDocument`, { method: "POST", body: form });
  const json = (await res.json()) as { ok: boolean; description?: string };
  if (!json.ok) throw new Error(json.description || "sendDocument failed");
}

export async function downloadTelegramFile(fileId: string): Promise<{ bytes: Uint8Array; mime: string; ext: string }> {
  const t = token();
  const file = (await tg("getFile", { file_id: fileId })) as { file_path?: string };
  if (!file.file_path) throw new Error("file_path missing");
  const res = await fetch(`${API}/file/bot${t}/${file.file_path}`);
  if (!res.ok) throw new Error("download failed");
  const buf = new Uint8Array(await res.arrayBuffer());
  const lower = file.file_path.toLowerCase();
  const ext = lower.endsWith(".png") ? "png" : lower.endsWith(".webp") ? "webp" : "jpg";
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return { bytes: buf, mime, ext };
}

export async function setWebhook(url: string, secret: string) {
  return tg("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
}
