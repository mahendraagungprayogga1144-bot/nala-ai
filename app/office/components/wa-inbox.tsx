"use client";

import { useEffect, useState } from "react";
import { loadOfficeWaInbox } from "@/lib/office/actions";
import type { WaInboxThread } from "@/lib/office/types";

function clock(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(date);
}

export default function WaInbox({ businessId }: { businessId: string }) {
  const [threads, setThreads] = useState<WaInboxThread[]>([]);
  const [active, setActive] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancel = false;
    async function pull() {
      try {
        const result = await loadOfficeWaInbox(businessId);
        if (cancel) return;
        setThreads(result.threads);
        setNote(result.message || "");
        setActive((current) => (result.threads.some((thread) => thread.visitor === current) ? current : (result.threads[0]?.visitor ?? "")));
      } catch {
        if (!cancel) setNote("Chat belum bisa dimuat.");
      }
    }
    void pull();
    const timer = window.setInterval(() => void pull(), 5000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [businessId]);

  const thread = threads.find((item) => item.visitor === active) ?? null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed text-slate-400">
        Henima AI membalas sendiri, termasuk orang yang melamar kerja. Di sini kamu hanya melihat percakapannya.
      </p>
      {threads.length ? (
        <div className="flex flex-wrap gap-1.5">
          {threads.map((item) => (
            <button
              key={item.visitor}
              type="button"
              onClick={() => setActive(item.visitor)}
              className={[
                "rounded-lg px-2 py-1 text-left text-[11px]",
                item.visitor === active ? "bg-[#25D366] text-[#052e16]" : "border border-white/10 text-slate-200",
              ].join(" ")}
            >
              {item.label}
              <span className="ml-1 opacity-70">{clock(item.at)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">Belum ada chat masuk.</p>
      )}
      {thread ? (
        <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg bg-[#151921] p-2">
          {thread.messages.map((message) => (
            <p key={message.id} className={["whitespace-pre-wrap text-[11px] leading-relaxed", message.direction === "in" ? "text-slate-100" : "text-[#86efac]"].join(" ")}>
              <span className="mr-1 text-[10px] text-slate-500">{message.direction === "in" ? "Customer" : "Otomatis"} {clock(message.at)}</span>
              {message.body}
            </p>
          ))}
        </div>
      ) : null}
      {note ? <p className="text-[11px] text-slate-400">{note}</p> : null}
    </div>
  );
}
