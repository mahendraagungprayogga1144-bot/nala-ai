import "server-only";
import type { SalesDb } from "@/lib/henima-sales/db";
import { ownerChatIdsFromEnv, ownerSendMessage } from "./owner-bot";
import { resolveOwnerChatAllowlist } from "./owner-telegram";
import { answerHrQuestion, HR_HELP, loadHrFieldRoster } from "./owner-hr";
import { openIssuesNudge, ownerStatusText } from "./silent-watch";

type TgUpdate = {
  update_id?: number;
  message?: {
    chat?: { id?: number; type?: string };
    from?: { id?: number };
    text?: string;
  };
};

async function businessIdForChat(db: SalesDb, chatId: number) {
  const { data } = await db
    .from("module_sales_staff")
    .select("business_id")
    .eq("telegram_user_id", chatId)
    .eq("role", "FOUNDER")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if ((data as { business_id: string } | null)?.business_id) {
    return (data as { business_id: string }).business_id;
  }

  // Fallback: owner chat dari env — ambil bisnis founder aktif pertama.
  const envIds = ownerChatIdsFromEnv();
  if (envIds.includes(chatId)) {
    const { data: anyFounder } = await db
      .from("module_sales_staff")
      .select("business_id")
      .eq("role", "FOUNDER")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    return (anyFounder as { business_id: string } | null)?.business_id || null;
  }
  return null;
}

export async function handleOwnerBotUpdate(db: SalesDb, update: TgUpdate) {
  const msg = update.message;
  const chatId = Number(msg?.chat?.id || msg?.from?.id || 0);
  const text = (msg?.text || "").trim();
  if (!chatId || !text) return;

  const allow = await resolveOwnerChatAllowlist(db);
  if (allow.length && !allow.includes(chatId)) {
    await ownerSendMessage(chatId, "Bot ini khusus owner Henima (HRD lapangan).");
    return;
  }

  const rawCmd = text.split(/\s+/)[0]?.toLowerCase().replace(/@\w+$/, "") || "";
  const cmd = rawCmd.replace(/^\//, "");
  // status / etatus (typo) / laporan — dengan atau tanpa slash
  const wantsStatus = /^(status|etatus|statys|laporan|report)$/.test(cmd);

  if (cmd === "start" || cmd === "help") {
    await ownerSendMessage(chatId, HR_HELP);
    return;
  }

  const businessId = await businessIdForChat(db, chatId);
  if (!businessId) {
    await ownerSendMessage(
      chatId,
      "Belum terhubung ke data founder. Isi HENIMA_OWNER_CHAT_IDS atau link Telegram founder di Henima Sales, lalu /start lagi.",
    );
    return;
  }
  const bizId = businessId;

  async function withNudge(body: string) {
    const nudge = await openIssuesNudge(db, bizId).catch(() => null);
    return nudge ? `${body}\n\n${nudge}` : body;
  }

  if (wantsStatus) {
    await ownerSendMessage(chatId, await withNudge(await ownerStatusText(db, businessId)));
    return;
  }

  // Pertanyaan bebas: jawab dari data GPS asli (bukan tebakan).
  try {
    const people = await loadHrFieldRoster(db, businessId);
    const answered = answerHrQuestion(text, people);
    if (answered) {
      await ownerSendMessage(chatId, await withNudge(answered));
      return;
    }
  } catch {
    await ownerSendMessage(chatId, "HRD Henima\nGagal baca data lapangan. Coba /status sebentar lagi.");
    return;
  }

  const nudgeOnly = await openIssuesNudge(db, businessId).catch(() => null);
  await ownerSendMessage(
    chatId,
    [
      "HRD Henima",
      "Belum ketemu maksudnya. Coba:",
      "• /status",
      "• siapa senyap",
      "• status [nama sales]",
      "• belum absen",
      "• arti senyap",
      nudgeOnly ? `\n${nudgeOnly}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}
