/**
 * Tes bot HRD owner: kirim 1 pesan ke chat ID.
 *
 * Pakai:
 *   HENIMA_OWNER_BOT_TOKEN=... HENIMA_OWNER_CHAT_IDS=123 npx tsx scripts/test-owner-bot.ts
 * atau isi di .env.local lalu: npx tsx scripts/test-owner-bot.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadDotEnv() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] != null && process.env[m[1]] !== "") continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

async function main() {
  loadDotEnv();
  const token = process.env.HENIMA_OWNER_BOT_TOKEN?.trim() || "";
  const chats = (process.env.HENIMA_OWNER_CHAT_IDS || "")
    .split(/[,\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!token) {
    console.error("HENIMA_OWNER_BOT_TOKEN belum ada. Isi di .env.local atau Vercel dulu.");
    process.exit(1);
  }
  if (!chats.length) {
    console.error("HENIMA_OWNER_CHAT_IDS belum ada. Isi Telegram user id kamu.");
    process.exit(1);
  }

  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const me = (await meRes.json()) as { ok: boolean; description?: string; result?: { username?: string; first_name?: string } };
  if (!me.ok) {
    console.error("Token bot invalid:", me.description || me);
    process.exit(1);
  }
  console.log("Bot OK:", me.result?.username || me.result?.first_name);

  const text = [
    "HRD Henima — tes koneksi",
    "Kalau kamu baca ini, bot asisten owner sudah nyambung.",
    new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB",
  ].join("\n");

  for (const chatId of chats) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    const json = (await res.json()) as { ok: boolean; description?: string };
    if (!json.ok) {
      console.error(`Gagal kirim ke ${chatId}:`, json.description);
      console.error("Pastikan kamu sudah /start bot ini di Telegram.");
      process.exit(1);
    }
    console.log(`Terkirim ke chat ${chatId}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
