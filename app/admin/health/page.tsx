"use client";

import { useEffect, useState } from "react";

type Check = { name: string; ok: boolean; detail?: string };
type External = { label: string; href: string; expect?: string };

export default function AdminHealthPage() {
  const [data, setData] = useState<{
    ok: boolean;
    checks: Check[];
    settingsSummary: Record<string, unknown>;
    externalChecklist: External[];
    recentErrors: { id: string; source: string; message: string; created_at: string }[];
  } | null>(null);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    const res = await fetch("/api/admin/health");
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error || "Gagal load health");
      return;
    }
    setData(json);
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Health</h1>
          <p className="text-xs text-[#5A5B7A]">Status server app · refresh 30s</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-white/10 px-3 py-2 text-xs text-[#8B8AA0]"
        >
          Refresh
        </button>
      </div>

      {err && <p className="mb-4 text-sm text-[#EC4899]">{err}</p>}

      {data && (
        <>
          <div
            className="mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold"
            style={{
              borderColor: data.ok ? "#4ADE8033" : "#EC489933",
              background: "#0D0D1A",
              color: data.ok ? "#4ADE80" : "#EC4899",
            }}
          >
            {data.ok ? "Semua check inti OK" : "Ada masalah — cek detail di bawah"}
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {data.checks.map((c) => (
              <div
                key={c.name}
                className="rounded-2xl border border-white/[0.08] p-4"
                style={{ background: "#0D0D1A" }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium">{c.name}</p>
                  <span className={"text-xs font-bold " + (c.ok ? "text-[#4ADE80]" : "text-[#EC4899]")}>
                    {c.ok ? "OK" : "FAIL"}
                  </span>
                </div>
                <p className="text-xs break-all text-[#8B8AA0]">{c.detail}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 rounded-2xl border border-white/[0.08] p-4" style={{ background: "#0D0D1A" }}>
            <p className="mb-3 text-xs font-semibold tracking-wide text-[#8B8AA0] uppercase">
              Checklist eksternal (tidak bisa diubah dari app)
            </p>
            <ul className="space-y-2 text-sm">
              {data.externalChecklist.map((x) => (
                <li key={x.label}>
                  <a href={x.href} target="_blank" rel="noreferrer" className="text-[#38BDF8] hover:underline">
                    {x.label}
                  </a>
                  {x.expect ? <span className="ml-2 text-xs text-[#5A5B7A]">→ {x.expect}</span> : null}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/[0.08] p-4" style={{ background: "#0D0D1A" }}>
            <p className="mb-3 text-xs font-semibold tracking-wide text-[#8B8AA0] uppercase">Recent errors</p>
            {(data.recentErrors || []).length === 0 ? (
              <p className="text-sm text-[#5A5B7A]">Tidak ada error tercatat</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.recentErrors.map((e) => (
                  <li key={e.id} className="border-b border-white/[0.04] pb-2">
                    <span className="text-xs text-[#5A5B7A]">{new Date(e.created_at).toLocaleString("id-ID")}</span>
                    <p className="text-[#EC4899]">
                      [{e.source}] {e.message}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
