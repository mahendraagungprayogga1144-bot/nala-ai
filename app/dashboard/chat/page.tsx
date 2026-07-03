"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Message = { role: "user" | "assistant"; content: string };

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPertanian = searchParams.get("context") === "pertanian";
  const presetQ = searchParams.get("q");

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: isPertanian
        ? "Halo! Aku Gercep AI Pertanian 🌾 Tanya soal panen, pupuk, pestisida, HPP, estimasi keuntungan, atau komoditas terbaik — aku analisis dari data inventory kamu."
        : "Halo! Aku Gercep AI. Tanya omzet kasir, order hari ini, menu terlaris — atau cerita transaksi bisnis kamu, nanti otomatis aku catat.",
    },
  ]);
  const [input, setInput] = useState(presetQ || "");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent, overrideText?: string) => {
    e?.preventDefault();
    const userMessage = (overrideText ?? input).trim();
    if (!userMessage || loading) return;

    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          context: isPertanian ? "pertanian" : undefined,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Maaf, ada error." }]);
      if (data.transaction) {
        router.refresh();
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Waduh, gagal konek ke server. Coba lagi ya." }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (presetQ) handleSend(undefined, presetQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b border-white/5 px-8 py-4">
        <span className="font-semibold">{isPertanian ? "Gercep AI Pertanian" : "Gercep Chat"}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-[768px] w-full mx-auto">
        <div className="flex flex-col gap-4">
          {messages.map((m, i) => (
            <div key={i} className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={m.role === "user"
                ? "bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] text-[#0A0A12] px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[80%] text-sm font-medium"
                : "bg-[#0F0F1A] border border-white/10 px-4 py-2.5 rounded-2xl rounded-bl-sm max-w-[80%] text-sm font-medium"}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#0F0F1A] border border-white/10 px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm text-[#8B8AA0]">
                Gercep lagi mikir...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={handleSend} className="border-t border-white/5 px-8 py-4">
        <div className="max-w-[768px] mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isPertanian ? "Tanya soal panen, pupuk, HPP, keuntungan..." : "Tanya omzet kasir, order hari ini, atau cerita transaksi..."}
            className="flex-1 px-4 py-3 rounded-xl bg-[#0F0F1A] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50"
          />
          <button type="submit" disabled={loading} className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] text-[#0A0A12] font-semibold disabled:opacity-50">
            Kirim
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[#8B8AA0]">Memuat chat...</div>}>
      <ChatContent />
    </Suspense>
  );
}
