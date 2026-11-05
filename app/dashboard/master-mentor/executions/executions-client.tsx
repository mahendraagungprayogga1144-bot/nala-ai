"use client";

import { useEffect, useState } from "react";
import PhaseBanner from "../components/phase-banner";
import SectionCard from "../components/section-card";

export default function ExecutionsClient() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [actions, setActions] = useState<Record<string, unknown>[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/master-mentor/executions").then((r) => r.json()),
      fetch("/api/master-mentor/actions").then((r) => r.json()),
    ])
      .then(([ex, ac]) => {
        setRows(ex.executions || []);
        setActions((ac.actions || []).filter((a: { status: string }) =>
          ["executed", "failed", "rejected", "expired"].includes(a.status),
        ));
        setNotice(ex.notice || ac.notice || null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-5">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[#9CA3AF] uppercase">
          Phase 5
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111827]">
          Execution History
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Jejak eksekusi aksi yang sudah di-approve / ditolak / gagal.
        </p>
      </header>

      <div className="mb-4">
        <PhaseBanner message="Audit trail per aksi. Tidak ada eksekusi ganda dari satu approval." />
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
          {error}
        </div>
      ) : null}
      {notice ? <p className="mb-3 text-xs text-[#B45309]">{notice}</p> : null}

      <SectionCard title="Action outcomes" subtitle="Recent">
        <ul className="space-y-2 text-sm">
          {actions.length === 0 ? (
            <li className="text-[#6B7280]">Belum ada riwayat.</li>
          ) : (
            actions.slice(0, 40).map((a) => (
              <li key={String(a.id)} className="rounded-lg border border-[#F3F4F6] px-3 py-2">
                <span className="font-medium text-[#111827]">{String(a.title)}</span>
                <span className="ml-2 text-[11px] uppercase text-[#9CA3AF]">
                  {String(a.status)} · {String(a.action_type)}
                </span>
              </li>
            ))
          )}
        </ul>
      </SectionCard>

      <div className="mt-4">
        <SectionCard title="Execution log" subtitle="Attempts">
          <pre className="max-h-[420px] overflow-auto rounded-lg bg-[#F9FAFB] p-3 text-[11px] text-[#374151]">
            {JSON.stringify(rows.slice(0, 50), null, 2)}
          </pre>
        </SectionCard>
      </div>
    </div>
  );
}
