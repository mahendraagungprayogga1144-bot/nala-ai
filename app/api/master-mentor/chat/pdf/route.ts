import { withMentorOwner } from "@/lib/master-mentor/authz";
import { listMessages } from "@/lib/master-mentor/chat/conversation-service";
import {
  businessPdfTitle,
  henimaBusinessTextToPdf,
  isPdfExportFollowUp,
  pdfFileSlug,
} from "@/lib/master-mentor/chat/business-pdf";
import { toPlainChatText } from "@/lib/master-mentor/chat/plain-text";
import { cleanText } from "@/lib/master-mentor/text";
import { MentorValidationError } from "@/lib/master-mentor/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isPdfNotice(text: string) {
  const t = text.trim();
  if (/^PDF siap/i.test(t)) return true;
  if (/klik tombol Unduh PDF/i.test(t) && t.length < 280) return true;
  if (/Dokumen PDF siap/i.test(t) && t.length < 280) return true;
  return false;
}

/**
 * Build HENIMA business PDF from the best mentor reply in a conversation.
 */
export async function POST(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    let body: { conversationId?: string; title?: string };
    try {
      body = await request.json();
    } catch {
      throw new MentorValidationError("JSON tidak valid.");
    }

    const conversationId = cleanText(body.conversationId, 80);
    if (!conversationId) throw new MentorValidationError("conversationId wajib.");

    const rows = await listMessages(db, owner.userId, conversationId);
    if (!rows.length) throw new MentorValidationError("Percakapan kosong.");

    // Pick the longest real mentor reply (skip "PDF siap…" notices).
    let best: { content: string; index: number; len: number } | null = null;
    for (let i = 0; i < rows.length; i++) {
      const m = rows[i];
      if (m.role !== "assistant") continue;
      const text = String(m.content || "").trim();
      if (text.length < 60) continue;
      if (isPdfNotice(text)) continue;
      if (!best || text.length >= best.len) {
        best = { content: text, index: i, len: text.length };
      }
    }

    if (!best) {
      throw new MentorValidationError(
        "Belum ada isi mentor yang bisa dijadikan PDF. Tanya dulu (saran/rencana), baru minta PDF.",
      );
    }

    let priorUser: string | undefined;
    for (let j = best.index - 1; j >= 0; j--) {
      if (rows[j].role !== "user") continue;
      if (isPdfExportFollowUp(rows[j].content)) continue;
      priorUser = rows[j].content;
      break;
    }

    const title =
      cleanText(body.title, 120) ||
      businessPdfTitle(priorUser || "dokumen henima", priorUser || null);

    let data: string;
    try {
      data = await henimaBusinessTextToPdf(title, toPlainChatText(best.content));
    } catch (err) {
      throw new MentorValidationError(
        `Gagal render PDF: ${err instanceof Error ? err.message : "error"}`,
      );
    }

    if (!data || data.length < 40) {
      throw new MentorValidationError("File PDF kosong setelah render.");
    }

    return {
      name: `${pdfFileSlug(title)}.pdf`,
      mediaType: "application/pdf" as const,
      data,
      title,
    };
  });
}
