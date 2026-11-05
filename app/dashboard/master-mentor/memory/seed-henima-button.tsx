"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SeedHenimaButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (
      !window.confirm(
        "Isi otomatis data HENIMA Perfume?\n\n• Profil owner\n• Pengetahuan bisnis + stok V1/V2\n• Keuangan (omzet 16jt, kas 2jt, rumah 5jt)\n• Strategi, keputusan, pembelajaran\n\nAngka bertanda estimate — bisa diedit nanti.",
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/master-mentor/memory/seed-henima", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMsg(
        `Selesai. Keuangan baru: ${data.filled?.financial ?? 0}, pembelajaran: ${data.filled?.learnings ?? 0}. Buka Catatan Keuangan / Mentor Chat.`,
      );
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal mengisi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#D1D5DB] bg-[#F9FAFB] px-4 py-4">
      <p className="text-sm font-semibold text-[#111827]">Isi data HENIMA Perfume</p>
      <p className="mt-1 text-xs text-[#6B7280]">
        Satu klik: brand parfum, stok (V1 600 sampel · sisa jual ~450 · V2 pabrik 1400), omzet/kas, strategi BEP.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className="mt-3 rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? "Mengisi…" : "Isi semuanya sekarang"}
      </button>
      {msg ? <p className="mt-2 text-xs text-[#065F46]">{msg}</p> : null}
      {err ? <p className="mt-2 text-xs text-[#B91C1C]">{err}</p> : null}
    </div>
  );
}
