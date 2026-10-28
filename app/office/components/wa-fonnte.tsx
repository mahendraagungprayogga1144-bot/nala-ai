"use client";

import { useEffect, useState, type FormEvent } from "react";
import { loadOfficeFonnte, saveOfficeFonnte } from "@/lib/office/actions";

export default function WaFonnte({ businessId }: { businessId: string }) {
  const [token, setToken] = useState("");
  const [webhook, setWebhook] = useState("");
  const [device, setDevice] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancel = false;
    void loadOfficeFonnte(businessId).then((result) => {
      if (cancel) return;
      setWebhook(result.webhook || "");
      setDevice(result.device || "");
      setHasToken(Boolean(result.hasToken));
      if (result.message) setNote(result.message);
    });
    return () => {
      cancel = true;
    };
  }, [businessId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    const result = await saveOfficeFonnte(businessId, token);
    setNote(result.message || "");
    if (result.ok) {
      setToken("");
      setHasToken(true);
      setWebhook(result.webhook || webhook);
      setDevice(result.device || "");
    }
    setPending(false);
  }

  async function copyWebhook() {
    if (!webhook) return;
    await navigator.clipboard.writeText(webhook);
    setCopied(true);
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed text-slate-400">
        WhatsApp dipegang lewat Fonnte. Di Fonnte, hubungkan nomornya dan pindai kode QR yang muncul di sana. Nyalakan inbox dan autoread, tempel webhook di bawah, lalu simpan token perangkat. Chat yang masuk setelah itu dibalas Henima AI sendiri.
      </p>
      {device ? <p className="text-xs text-[#86efac]">Perangkat {device}</p> : null}
      {hasToken && !device ? <p className="text-xs text-slate-300">Token tersimpan. Status perangkat belum connect.</p> : null}
      {webhook ? (
        <button type="button" onClick={() => void copyWebhook()} className="block break-all text-left text-xs text-[#25D366] underline">
          {copied ? "Webhook tersalin" : webhook}
        </button>
      ) : null}
      <form onSubmit={save} className="flex gap-2">
        <input
          value={token}
          onChange={(event) => setToken(event.target.value)}
          type="password"
          autoComplete="off"
          aria-label="Token perangkat Fonnte"
          placeholder={hasToken ? "Ganti token Fonnte" : "Token perangkat Fonnte"}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#151921] px-2 py-2 text-xs text-white"
        />
        <button type="submit" disabled={pending || token.trim().length < 10} className="rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-[#052e16] disabled:opacity-50">
          Simpan
        </button>
      </form>
      {note ? <p className="text-[11px] text-slate-400">{note}</p> : null}
    </div>
  );
}
