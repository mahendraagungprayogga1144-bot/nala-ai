"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import type { MentorPortfolioBusiness } from "@/lib/master-mentor/types";
import { categoryLabel } from "@/lib/master-mentor/types";
import PhaseBanner from "../components/phase-banner";

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  businessId: string | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "system";
  content: string;
  at: string;
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const PHASE3_NOTICE =
  "AI engine is not connected yet. Mentor responses will be available in Phase 3 when the Master Orchestrator and specialist agents are integrated. No simulated analysis is returned.";

export default function MentorChatClient({
  ownerName,
  portfolio,
}: {
  ownerName: string;
  portfolio: MentorPortfolioBusiness[];
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messagesById, setMessagesById] = useState<Record<string, ChatMessage[]>>({});
  const [draft, setDraft] = useState("");
  const [businessId, setBusinessId] = useState<string>(portfolio[0]?.id || "");
  const [specialist] = useState("Master Orchestrator (offline)");

  const active = conversations.find((c) => c.id === activeId) || null;
  const messages = activeId ? messagesById[activeId] || [] : [];

  const contextLabel = useMemo(() => {
    if (!businessId) return "No business selected";
    const row = portfolio.find((b) => b.id === businessId);
    return row ? `${row.name} · ${categoryLabel(row.category)}` : "Unknown business";
  }, [businessId, portfolio]);

  const startConversation = () => {
    const id = uid();
    const row: Conversation = {
      id,
      title: "New consultation",
      createdAt: new Date().toISOString(),
      businessId: businessId || null,
    };
    setConversations((prev) => [row, ...prev]);
    setMessagesById((prev) => ({
      ...prev,
      [id]: [
        {
          id: uid(),
          role: "system",
          content: PHASE3_NOTICE,
          at: new Date().toISOString(),
        },
      ],
    }));
    setActiveId(id);
  };

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;

    let convoId = activeId;
    if (!convoId) {
      convoId = uid();
      const row: Conversation = {
        id: convoId,
        title: text.slice(0, 48) || "New consultation",
        createdAt: new Date().toISOString(),
        businessId: businessId || null,
      };
      setConversations((prev) => [row, ...prev]);
      setActiveId(convoId);
      setMessagesById((prev) => ({ ...prev, [convoId!]: [] }));
    } else {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convoId && c.title === "New consultation"
            ? { ...c, title: text.slice(0, 48) }
            : c,
        ),
      );
    }

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: text,
      at: new Date().toISOString(),
    };
    const systemMsg: ChatMessage = {
      id: uid(),
      role: "system",
      content: PHASE3_NOTICE,
      at: new Date().toISOString(),
    };

    setMessagesById((prev) => ({
      ...prev,
      [convoId!]: [...(prev[convoId!] || []), userMsg, systemMsg],
    }));
    setDraft("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[#E5E7EB] px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-[#111827]">Mentor Chat</h1>
            <p className="mt-0.5 text-sm text-[#6B7280]">
              Consultation desk for {ownerName}
            </p>
          </div>
          <button
            type="button"
            onClick={startConversation}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#111827] hover:bg-[#F9FAFB]"
          >
            <Plus size={15} />
            New conversation
          </button>
        </div>
        <div className="mt-3">
          <PhaseBanner message="Phase 1 UI only. Prompts are accepted for layout testing; the AI engine connects in Phase 3. No fabricated mentor answers." />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Conversation sidebar */}
        <aside className="flex max-h-[40vh] w-full shrink-0 flex-col border-b border-[#E5E7EB] lg:max-h-none lg:w-[280px] lg:border-r lg:border-b-0">
          <div className="border-b border-[#F3F4F6] px-4 py-3">
            <p className="text-xs font-semibold tracking-wide text-[#9CA3AF] uppercase">
              Chat history
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#E5E7EB] px-3 py-8 text-center">
                <MessageSquare size={16} className="mx-auto text-[#9CA3AF]" />
                <p className="mt-2 text-xs text-[#6B7280]">No conversations yet.</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(c.id)}
                      className={[
                        "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                        activeId === c.id
                          ? "bg-[#111827] text-white"
                          : "text-[#374151] hover:bg-[#F3F4F6]",
                      ].join(" ")}
                    >
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p
                        className={[
                          "mt-0.5 text-[11px]",
                          activeId === c.id ? "text-white/70" : "text-[#9CA3AF]",
                        ].join(" ")}
                      >
                        {new Date(c.createdAt).toLocaleString("id-ID")}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Message area */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b border-[#E5E7EB] px-4 py-3 sm:px-5">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-[#6B7280]">
              Business context
              <select
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#9CA3AF]"
              >
                {portfolio.length === 0 ? (
                  <option value="">No portfolio business</option>
                ) : (
                  portfolio.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2">
              <p className="text-[10px] font-semibold tracking-wide text-[#9CA3AF] uppercase">
                Specialist
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-[#4B5563]">
                <Bot size={13} />
                {specialist}
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
            {!active ? (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#FAFAFA]">
                  <Sparkles size={18} className="text-[#6B7280]" />
                </div>
                <p className="mt-3 text-sm font-medium text-[#111827]">Start a consultation</p>
                <p className="mt-1 max-w-sm text-sm text-[#6B7280]">
                  Context: {contextLabel}. Messages are stored locally in this session only until
                  Phase 3 persistence lands.
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={[
                    "max-w-[85%] rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "ml-auto border-[#111827] bg-[#111827] text-white"
                      : "border-[#E5E7EB] bg-[#F9FAFB] text-[#374151]",
                  ].join(" ")}
                >
                  {m.role === "system" ? (
                    <p className="mb-1 text-[10px] font-semibold tracking-wide text-[#9CA3AF] uppercase">
                      System
                    </p>
                  ) : null}
                  {m.content}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-[#E5E7EB] p-4 sm:px-5">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder="Write a prompt for your business mentor…"
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#9CA3AF]"
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
                disabled={!draft.trim()}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#111827] px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={15} />
                Send
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
