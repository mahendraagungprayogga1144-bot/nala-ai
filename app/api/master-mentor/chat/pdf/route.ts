import { NextResponse } from "next/server";
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

/**
 * Build/download a HENIMA business PDF from conversation content.
 * Avoids stuffing huge base64 into the chat SSE stream (which hid the download button).
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

    // Prefer long mentor reply (skip short "PDF siap…" notices).
    let source: { content: string; priorUser?: string } | null = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      const m = rows[i];
      if (m.role !== "assistant") continue;
      const text = String(m.content || "").trim();
      if (text.length < 80) continue;
      if (/^PDF siap/i.test(text)) continue;
      if (/Dokumen PDF siap diunduh/i.test(text) && text.length < 200) continue;
      let priorUser: string | undefined;
      for (let j = i - 1; j >= 0; j--) {
        if (rows[j].role === "user") {
          priorUser = rows[j].content;
          break;
        }
      }
      // If prior user was only "buatkan pdfnya", look one ask further for title context
      if (priorUser && isPdfExportFollowUp(priorUser)) {
        for (let j = i - 1; j >= 0; j--) {
          if (rows[j].role === "user" && !isPdfExportFollowUp(rows[j].content)) {
            priorUser = rows[j].content;
            break;
          }
        }
      }
      source = { content: text, priorUser };
      break;
    }

    if (!source) {
      throw new MentorValidationError(
        "Belum ada isi mentor yang bisa dijadikan PDF. Tanya dulu, baru minta PDF.",
      );
    }

    const title =
      cleanText(body.title, 120) ||
      businessPdfTitle(source.priorUser || "dokumen", source.priorUser || null);
    const data = await henimaBusinessTextToPdf(title, toPlainChatText(source.content));

    return {
      name: `${pdfFileSlug(title)}.pdf`,
      mediaType: "application/pdf" as const,
      data,
      title,
    };
  });
}
