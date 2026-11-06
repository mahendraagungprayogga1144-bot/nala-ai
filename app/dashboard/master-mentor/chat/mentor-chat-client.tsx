"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, MessageSquare, Plus, Send, Sparkles } from "lucide-react";
import type { MentorPortfolioBusiness } from "@/lib/master-mentor/types";
import { categoryLabel } from "@/lib/master-mentor/types";
import { toPlainChatText } from "@/lib/master-mentor/chat/plain-text";
import { useMentorLocale } from "../components/mentor-locale-provider";

type Conversation = {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
};

type ChatPdf = {
  name: string;
  mediaType: string;
  data: string;
  title?: string;
};

type PdfMeta = { ready?: boolean; title?: string; name?: string };

async function fetchConversationPdf(conversationId: string, title?: string): Promise<ChatPdf> {
  const res = await fetch("/api/master-mentor/chat/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, title: title || undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Gagal PDF (${res.status})`);
  if (!data.data) throw new Error("File PDF kosong.");
  return {
    name: data.name || "henima-dokumen.pdf",
    mediaType: data.mediaType || "application/pdf",
    data: data.data,
    title: data.title,
  };
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  specialists?: string[];
  sources_used?: string[];
  missing?: string[];
  /** Show download button; file fetched on click (reliable). */
  pdfReady?: boolean;
  pdfTitle?: string;
};

function downloadPdf(file: ChatPdf) {
  const a = document.createElement("a");
  a.href = `data:${file.mediaType || "application/pdf"};base64,${file.data}`;
  a.download = file.name || "henima-dokumen.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function looksLikePdfOffer(content: string) {
  return /PDF siap|Unduh PDF|unduh di bawah|dokumen PDF siap/i.test(content);
}

type SpecialistEvent = { id: string; label: string; status: "running" | "done" };

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function MentorChatClient({
  ownerName,
  portfolio,
}: {
  ownerName: string;
  portfolio: MentorPortfolioBusiness[];
}) {
  const { locale, t } = useMentorLocale();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [businessId, setBusinessId] = useState<string>(portfolio[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specialists, setSpecialists] = useState<SpecialistEvent[]>([]);
  const [statusLine, setStatusLine] = useState("");
  const [search, setSearch] = useState("");
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);

  const contextLabel = useMemo(() => {
    if (!businessId) return t.chat.noPortfolio;
    const row = portfolio.find((b) => b.id === businessId);
    return row ? `${row.name} · ${categoryLabel(row.category)}` : t.chat.noPortfolio;
  }, [businessId, portfolio, t]);

  const loadConversations = async (q = "") => {
    const res = await fetch(`/api/master-mentor/chat?q=${encodeURIComponent(q)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || t.chat.failLoadConversations);
    setConversations(data.conversations || []);
  };

  const loadConversation = async (id: string) => {
    const res = await fetch(`/api/master-mentor/chat/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || t.chat.failLoadMessages);
    setActiveId(id);
    setMessages(
      (data.messages || []).map((m: ChatMessage) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        specialists: m.specialists,
        sources_used: m.sources_used,
        missing: m.missing,
        pdfReady: m.role === "assistant" && looksLikePdfOffer(String(m.content || "")),
      })),
    );
  };

  const handleDownloadPdf = async (messageId: string, title?: string) => {
    const convId = activeId;
    if (!convId) {
      setError("Buka percakapan dulu, lalu unduh PDF.");
      return;
    }
    setPdfBusyId(messageId);
    setError(null);
    try {
      const file = await fetchConversationPdf(convId, title);
      downloadPdf(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal unduh PDF");
    } finally {
      setPdfBusyId(null);
    }
  };

  useEffect(() => {
    loadConversations().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const startConversation = () => {
    setActiveId(null);
    setMessages([]);
    setSpecialists([]);
    setStatusLine("");
    setError(null);
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setSpecialists([]);
    setStatusLine(t.chat.preparing);
    setDraft("");

    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    const assistantId = uid();
    // Only show user bubble first — no empty "…" assistant bubbles (normal chat UX).
    setMessages((prev) => [...prev, userMsg]);

    const abort = new AbortController();
    const hangTimer = window.setTimeout(() => abort.abort(), 120_000);

    const ensureAssistant = () => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === assistantId)) return prev;
        return [...prev, { id: assistantId, role: "assistant", content: "" }];
      });
    };

    try {
      setStatusLine("Mentor lagi ngetik…");
      const res = await fetch("/api/master-mentor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          message: text,
          conversationId: activeId,
          businessId: businessId || null,
          locale,
          stream: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Gagal (${res.status})`);
      }

      const ctype = res.headers.get("content-type") || "";
      if (!ctype.includes("text/event-stream") || !res.body) {
        const data = await res.json();
        setActiveId(data.conversationId || activeId);
        ensureAssistant();
        const pdfMeta = data.pdf as PdfMeta | null;
        const content = data.message?.content || data.reply || "";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content,
                  specialists: (data.specialists || []).map((s: { id: string }) => s.id),
                  sources_used: data.sourcesUsed,
                  missing: data.missing,
                  pdfReady: Boolean(pdfMeta?.ready) || looksLikePdfOffer(content),
                  pdfTitle: pdfMeta?.title,
                }
              : m,
          ),
        );
        await loadConversations(search);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }

          if (evt.type === "meta" && typeof evt.conversationId === "string") {
            setActiveId(evt.conversationId);
          }
          if (evt.type === "status" && typeof evt.message === "string") {
            // Keep status short & human — hide long orchestrator jargon in the typing line.
            const raw = evt.message;
            if (/Orchestrator|Routing|provider|Memory|intelligence/i.test(raw)) {
              setStatusLine("Mentor lagi ngetik…");
            } else {
              setStatusLine(raw);
            }
          }
          if (evt.type === "specialist_start" && typeof evt.specialist === "string") {
            const id = String(evt.specialist);
            const label = String(evt.label || id);
            setSpecialists((prev) => {
              const others = prev.filter((s) => s.id !== id);
              return [...others, { id, label, status: "running" }];
            });
            setStatusLine("Mentor lagi ngetik…");
          }
          if (evt.type === "specialist_done" && typeof evt.specialist === "string") {
            const id = String(evt.specialist);
            setSpecialists((prev) =>
              prev.map((s) => (s.id === id ? { ...s, status: "done" } : s)),
            );
          }
          if (evt.type === "token" && typeof evt.text === "string") {
            ensureAssistant();
            assembled += evt.text;
            const snap = assembled;
            setStatusLine("");
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: snap } : m)),
            );
          }
          if (evt.type === "error") {
            throw new Error(String(evt.message || "Provider error"));
          }
          if (evt.type === "final") {
            if (typeof evt.conversationId === "string") setActiveId(evt.conversationId);
            const finalText =
              (evt.message as { content?: string } | undefined)?.content || assembled;
            const specs = ((evt.specialists as { id: string }[]) || []).map((s) => s.id);
            const pdfMeta = evt.pdf as PdfMeta | null;
            ensureAssistant();
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: finalText,
                      specialists: specs,
                      sources_used: (evt.sourcesUsed as string[]) || [],
                      missing: (evt.missing as string[]) || [],
                      pdfReady: Boolean(pdfMeta?.ready) || looksLikePdfOffer(finalText),
                      pdfTitle: pdfMeta?.title,
                    }
                  : m,
              ),
            );
            setStatusLine("");
          }
        }
      }
      await loadConversations(search);
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      const message = aborted
        ? "Balasan terlalu lama. Coba percakapan baru & pertanyaan lebih singkat. Cek ANTHROPIC_API_KEY di Vercel."
        : err instanceof Error
          ? err.message
          : t.chat.failRespond;
      setError(message);
      setMessages((prev) => {
        const withoutEmpty = prev.filter((m) => m.id !== assistantId || m.content);
        return [
          ...withoutEmpty,
          { id: uid(), role: "system", content: message },
        ];
      });
    } finally {
      window.clearTimeout(hangTimer);
      setBusy(false);
      setStatusLine("");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[#E5E7EB] px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-[#111827]">{t.chat.title}</h1>
            <p className="mt-0.5 text-sm text-[#6B7280]">{t.chat.deskFor(ownerName)}</p>
          </div>
          <button
            type="button"
            onClick={startConversation}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#111827] hover:bg-[#F9FAFB]"
          >
            <Plus size={15} />
            {t.chat.newConversation}
          </button>
        </div>
        {error ? (
          <div className="mt-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex max-h-[40vh] w-full shrink-0 flex-col border-b border-[#E5E7EB] lg:max-h-none lg:w-[280px] lg:border-r lg:border-b-0">
          <div className="border-b border-[#F3F4F6] px-4 py-3">
            <p className="text-xs font-semibold tracking-wide text-[#9CA3AF] uppercase">
              {t.chat.history}
            </p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadConversations(search).catch(() => undefined);
              }}
              placeholder={t.chat.searchPlaceholder}
              className="mt-2 w-full rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-sm outline-none focus:border-[#9CA3AF]"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#E5E7EB] px-3 py-8 text-center">
                <MessageSquare size={16} className="mx-auto text-[#9CA3AF]" />
                <p className="mt-2 text-xs text-[#6B7280]">{t.chat.noConversations}</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() =>
                        loadConversation(c.id).catch((e) => setError(String(e.message || e)))
                      }
                      className={[
                        "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                        activeId === c.id
                          ? "bg-[#111827] text-white"
                          : "text-[#374151] hover:bg-[#F3F4F6]",
                      ].join(" ")}
                    >
                      <p className="truncate text-sm font-medium">{c.title}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b border-[#E5E7EB] px-4 py-3 sm:px-5">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-[#6B7280]">
              {t.chat.businessContext}
              <select
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#9CA3AF]"
              >
                {portfolio.length === 0 ? (
                  <option value="">{t.chat.noPortfolio}</option>
                ) : (
                  portfolio.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            {!busy && specialists.length > 0 ? (
              <div className="min-w-[160px] rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2">
                <p className="text-[10px] font-semibold tracking-wide text-[#9CA3AF] uppercase">
                  {t.chat.specialists}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {specialists.map((s) => (
                    <li key={s.id} className="text-xs text-[#374151]">
                      {s.label} · {s.status === "running" ? t.chat.running : t.chat.done}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
            {messages.length === 0 && !busy ? (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#FAFAFA]">
                  <Sparkles size={18} className="text-[#6B7280]" />
                </div>
                <p className="mt-3 text-sm font-medium text-[#111827]">{t.chat.startTitle}</p>
                <p className="mt-1 max-w-sm text-sm text-[#6B7280]">
                  {t.chat.startBody(contextLabel)}
                </p>
              </div>
            ) : (
              messages
                .filter((m) => m.content.trim().length > 0)
                .map((m) => (
                <div
                  key={m.id}
                  className={[
                    "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "ml-auto bg-[#111827] text-white"
                      : m.role === "system"
                        ? "border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
                        : "bg-[#F3F4F6] text-[#111827]",
                  ].join(" ")}
                >
                  {m.role === "assistant" ? toPlainChatText(m.content) : m.content}
                  {m.role === "assistant" && (m.pdfReady || looksLikePdfOffer(m.content)) ? (
                    <button
                      type="button"
                      disabled={pdfBusyId === m.id || !activeId}
                      onClick={() => handleDownloadPdf(m.id, m.pdfTitle)}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#111827] px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-[#1F2937] disabled:opacity-50"
                    >
                      <Download size={14} />
                      {pdfBusyId === m.id
                        ? "Menyiapkan PDF…"
                        : `Unduh PDF${m.pdfTitle ? ` · ${m.pdfTitle}` : ""}`}
                    </button>
                  ) : null}
                </div>
              ))
            )}
            {busy ? (
              <p className="max-w-[75%] px-1 text-sm text-[#9CA3AF]">
                {statusLine || "Mentor lagi ngetik…"}
              </p>
            ) : null}
          </div>

          <div className="border-t border-[#E5E7EB] p-4 sm:px-5">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                disabled={busy}
                placeholder={t.chat.placeholder}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#9CA3AF] disabled:opacity-60"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={busy || !draft.trim()}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#111827] px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={15} />
                {t.chat.send}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
