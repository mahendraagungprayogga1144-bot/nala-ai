"use client";

import { useState, type FormEvent } from "react";
import { adjustOfficeStock, askOfficeAgent } from "@/lib/office/actions";
import { suggestionsFor } from "@/lib/office/present";
import { STOK_AGENT_ID, type OfficeAgent, type OfficeSnapshot } from "@/lib/office/types";

export default function OfficeWorkPanel({
  agent,
  snapshot,
  onSnapshot,
}: {
  agent: OfficeAgent;
  snapshot: OfficeSnapshot;
  onSnapshot: (snapshot: OfficeSnapshot) => void;
}) {
  const suggestions = suggestionsFor(agent.id);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [productId, setProductId] = useState(snapshot.products[0]?.id ?? "");
  const [direction, setDirection] = useState<"masuk" | "keluar">("masuk");
  const [quantity, setQuantity] = useState("1");
  const chosen = snapshot.products.some((product) => product.id === productId) ? productId : (snapshot.products[0]?.id ?? "");

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setAnswer(null);
    try {
      const result = await askOfficeAgent(snapshot.business_id, agent.id, trimmed);
      setAnswer(result.message);
      onSnapshot(result.snapshot);
    } catch {
      setAnswer("Jawaban belum bisa diambil. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  async function adjust(event: FormEvent) {
    event.preventDefault();
    if (pending || !chosen) return;
    const amount = Number(quantity);
    setPending(true);
    setAnswer(null);
    try {
      const result = await adjustOfficeStock({
        businessId: snapshot.business_id,
        productId: chosen,
        direction,
        quantity: amount,
      });
      setAnswer(result.message);
      onSnapshot(result.snapshot);
    } catch {
      setAnswer("Stok belum berubah. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold text-slate-500">Tanya atau suruh</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((item) => (
            <button
              key={item}
              type="button"
              disabled={pending}
              onClick={() => {
                setQuestion(item);
                void ask(item);
              }}
              className="rounded-lg border border-white/[0.08] bg-[#0b0e14] px-2 py-1 text-left text-[11px] leading-snug text-slate-200 hover:border-[#2DD4BF]/40 disabled:opacity-50"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={agent.id === STOK_AGENT_ID ? "Contoh: tambah stok Teh 5" : "Tulis pertanyaan"}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#2DD4BF]/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !question.trim()}
          className="rounded-lg bg-[#2DD4BF] px-3 py-2 text-xs font-semibold text-[#042f2e] disabled:opacity-50"
        >
          Kirim
        </button>
      </form>
      {agent.id === STOK_AGENT_ID ? (
        <form onSubmit={adjust} className="space-y-2 rounded-xl border border-white/[0.06] bg-[#0b0e14] p-3">
          <p className="text-[11px] font-semibold text-slate-500">Atur stok</p>
          {snapshot.products.length ? (
            <>
              <select
                value={chosen}
                onChange={(event) => setProductId(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#151921] px-2 py-2 text-xs text-white"
              >
                {snapshot.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · sisa {product.stock}
                    {product.unit ? ` ${product.unit}` : ""}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <select
                  value={direction}
                  onChange={(event) => setDirection(event.target.value === "keluar" ? "keluar" : "masuk")}
                  className="rounded-lg border border-white/10 bg-[#151921] px-2 py-2 text-xs text-white"
                >
                  <option value="masuk">Tambah</option>
                  <option value="keluar">Kurangi</option>
                </select>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="w-20 rounded-lg border border-white/10 bg-[#151921] px-2 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg border border-[#2DD4BF]/40 px-3 py-2 text-xs font-semibold text-[#2DD4BF] disabled:opacity-50"
                >
                  Simpan
                </button>
              </div>
            </>
          ) : (
            <p className="text-[11px] leading-relaxed text-slate-400">Belum ada produk yang bisa diatur dari sini.</p>
          )}
        </form>
      ) : null}
      {answer ? <p className="rounded-xl bg-[#0b0e14] px-3 py-2.5 text-sm leading-relaxed text-slate-100">{answer}</p> : null}
      {pending ? <p className="text-[11px] text-slate-500">Sedang membaca data…</p> : null}
    </div>
  );
}
