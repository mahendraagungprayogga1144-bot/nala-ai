"use client";

import { useEffect, useState, type FormEvent } from "react";

type Bubble = { id: string; direction: "in" | "out"; body: string };

function visitorKey() {
  const key = "gercep_wa_visitor";
  const saved = window.localStorage.getItem(key);
  if (saved && /^[a-zA-Z0-9_-]{8,40}$/.test(saved)) return saved;
  const next = `v${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`.slice(0, 40);
  window.localStorage.setItem(key, next);
  return next;
}

export default function WaChat({ token, brand, greeting }: { token: string; brand: string; greeting: string }) {
  const [visitor, setVisitor] = useState("");
  const [messages, setMessages] = useState<Bubble[]>([{ id: "greet", direction: "out", body: greeting }]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setVisitor(visitorKey());
  }, []);

  useEffect(() => {
    if (!visitor) return;
    let cancel = false;
    async function pull() {
      const res = await fetch(`/api/wa-reply?token=${encodeURIComponent(token)}&visitor=${encodeURIComponent(visitor)}`);
      const data = (await res.json()) as { messages?: Bubble[] };
      if (cancel || !Array.isArray(data.messages)) return;
      setMessages([{ id: "greet", direction: "out", body: greeting }, ...data.messages]);
    }
    void pull();
    const timer = window.setInterval(() => void pull(), 4000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [visitor, token, greeting]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const clean = text.trim();
    if (!clean || !visitor || pending) return;
    setPending(true);
    setError("");
    setText("");
    try {
      const res = await fetch("/api/wa-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, visitor, text: clean }),
      });
      const data = (await res.json()) as { reply?: string; message?: string };
      if (!res.ok || !data.reply) setError(data.message || "Balasan belum terkirim.");
      const listed = await fetch(`/api/wa-reply?token=${encodeURIComponent(token)}&visitor=${encodeURIComponent(visitor)}`);
      const fresh = (await listed.json()) as { messages?: Bubble[] };
      if (Array.isArray(fresh.messages)) setMessages([{ id: "greet", direction: "out", body: greeting }, ...fresh.messages]);
    } catch {
      setError("Balasan belum terkirim. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-[#ECE5DD] text-[#111B21]">
      <header className="bg-[#075E54] px-4 py-3 text-white">
        <p className="text-xs text-white/70">Balasan otomatis</p>
        <h1 className="text-lg font-semibold">{brand}</h1>
      </header>
      <div className="flex flex-1 flex-col gap-2 px-3 py-4">
        {messages.map((row) => (
          <p
            key={row.id}
            className={[
              "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed shadow-sm",
              row.direction === "out" ? "self-start bg-white" : "self-end bg-[#DCF8C6]",
            ].join(" ")}
          >
            {row.body}
          </p>
        ))}
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-black/5 bg-[#F0F0F0] p-3">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Tulis pesan"
          className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-sm outline-none"
        />
        <button type="submit" disabled={pending || !text.trim()} className="rounded-full bg-[#075E54] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Kirim
        </button>
      </form>
    </main>
  );
}
