import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  appendMessage,
  createConversation,
  listConversations,
  listMessages,
} from "@/lib/master-mentor/chat/conversation-service";
import { runMasterOrchestrator } from "@/lib/master-mentor/orchestrator/run";
import { ProviderConfigError, ProviderRuntimeError } from "@/lib/master-mentor/providers";
import { MentorValidationError } from "@/lib/master-mentor/types";
import { proposeFromChatTurn } from "@/lib/master-mentor/actions/propose-from-chat";
import { resolveMentorLocale } from "@/lib/master-mentor/i18n";
import { cleanText } from "@/lib/master-mentor/text";

export const dynamic = "force-dynamic";
/** Parallel specialists + chairman; keep within common Hobby-compatible budgets. */
export const maxDuration = 120;

export async function GET(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    const q = new URL(request.url).searchParams.get("q") || undefined;
    const { rows, notice } = await listConversations(db, owner.userId, q);
    return { conversations: rows, notice };
  });
}

export async function POST(request: Request) {
  // Streaming path uses raw Response; auth still via resolve inside withMentorOwner pattern.
  // For SSE we manually gate then stream.
  const { createClient } = await import("@/lib/supabase/server");
  const { resolveMentorOwner } = await import("@/lib/master-mentor/authz");

  let owner;
  try {
    owner = await resolveMentorOwner();
  } catch (err) {
    if (err instanceof MentorValidationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    const { MentorAuthError } = await import("@/lib/master-mentor/types");
    if (err instanceof MentorAuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.httpStatus });
    }
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  let body: {
    message?: string;
    conversationId?: string;
    businessId?: string;
    stream?: boolean;
    locale?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON tidak valid.", code: "invalid_json" }, { status: 400 });
  }

  const message = cleanText(body.message, 8000);
  if (!message) {
    return NextResponse.json({ error: "Pesan kosong.", code: "validation_error" }, { status: 400 });
  }

  const locale = resolveMentorLocale(body.locale);
  const db = await createClient();
  const wantStream = body.stream !== false;

  try {
    let conversationId = cleanText(body.conversationId, 80);
    if (!conversationId) {
      const conv = await createConversation(db, owner.userId, {
        businessId: cleanText(body.businessId, 80) || null,
        title: message.slice(0, 48),
      });
      conversationId = conv.id;
    }

    await appendMessage(db, owner.userId, {
      conversationId,
      role: "user",
      content: message,
    });

    const historyRows = await listMessages(db, owner.userId, conversationId);
    const history = historyRows
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(0, -1)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    if (!wantStream) {
      const result = await runMasterOrchestrator({
        db,
        ownerUserId: owner.userId,
        question: message,
        businessId: cleanText(body.businessId, 80) || null,
        history,
        conversationId,
        locale,
        streamFinal: false,
      });
      const saved = await appendMessage(db, owner.userId, {
        conversationId,
        role: "assistant",
        content: result.reply,
        specialists: result.specialists.filter((s) => s.ran).map((s) => s.id),
        sourcesUsed: result.sourcesUsed,
        missing: result.missing,
        usage: result.usage as unknown as Record<string, unknown>,
      });
      const proposals = await proposeFromChatTurn(db, {
        ownerUserId: owner.userId,
        businessId: cleanText(body.businessId, 80) || null,
        conversationId,
        question: message,
        reply: result.reply,
        specialists: result.specialists,
        missing: result.missing,
        sourcesUsed: result.sourcesUsed,
      });
      return NextResponse.json({
        conversationId,
        message: saved,
        specialists: result.specialists.filter((s) => s.ran),
        sourcesUsed: result.sourcesUsed,
        missing: result.missing,
        usage: result.usage,
        proposals,
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };
        // Immediate flush so UI leaves "Menyiapkan…" even before DB/LLM work.
        send({ type: "meta", conversationId });
        send({ type: "status", message: "Mentor lagi ngetik…" });
        try {
          const result = await runMasterOrchestrator({
            db,
            ownerUserId: owner.userId,
            question: message,
            businessId: cleanText(body.businessId, 80) || null,
            history,
            conversationId,
            locale,
            streamFinal: true,
            onProgress: (e) => send(e),
          });
          const saved = await appendMessage(db, owner.userId, {
            conversationId,
            role: "assistant",
            content: result.reply,
            specialists: result.specialists.filter((s) => s.ran).map((s) => s.id),
            sourcesUsed: result.sourcesUsed,
            missing: result.missing,
            usage: result.usage as unknown as Record<string, unknown>,
          });
          const proposals = await proposeFromChatTurn(db, {
            ownerUserId: owner.userId,
            businessId: cleanText(body.businessId, 80) || null,
            conversationId,
            question: message,
            reply: result.reply,
            specialists: result.specialists,
            missing: result.missing,
            sourcesUsed: result.sourcesUsed,
          });
          send({
            type: "final",
            conversationId,
            message: saved,
            specialists: result.specialists.filter((s) => s.ran),
            sourcesUsed: result.sourcesUsed,
            missing: result.missing,
            usage: result.usage,
            proposals,
          });
        } catch (err) {
          const msg =
            err instanceof ProviderConfigError || err instanceof ProviderRuntimeError || err instanceof Error
              ? err.message
              : "Gagal menjalankan Master Mentor.";
          const code =
            err instanceof ProviderConfigError
              ? err.code
              : err instanceof ProviderRuntimeError
                ? err.code
                : "orchestrator_error";
          send({ type: "error", message: msg, code });
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    if (err instanceof MentorValidationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    if (err instanceof ProviderConfigError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 503 });
    }
    console.error("[master-mentor/chat]", err);
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
