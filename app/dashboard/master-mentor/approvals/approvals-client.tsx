"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import PhaseBanner from "../components/phase-banner";
import SectionCard from "../components/section-card";

type ActionRow = {
  id: string;
  title: string;
  description: string;
  action_type: string;
  risk_level: string;
  status: string;
  expected_impact: string;
  business_context: string;
  requested_permissions: string[];
  expires_at: string;
  created_at: string;
};

type CandidateRow = {
  id: string;
  memory_kind: string;
  classification: string;
  status: string;
  source_ref: string;
  created_at: string;
  proposed_payload?: Record<string, unknown>;
};

export default function ApprovalsClient() {
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [a, c] = await Promise.all([
      fetch("/api/master-mentor/actions?status=pending").then((r) => r.json()),
      fetch("/api/master-mentor/memory/candidates?status=pending").then((r) => r.json()),
    ]);
    if (a.error) setError(a.error);
    setActions(a.actions || []);
    setNotice(a.notice || c.notice || null);
    setCandidates(c.candidates || c.rows || []);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [load]);

  const reviewAction = async (id: string, decision: "approve" | "reject") => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/master-mentor/actions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal review aksi");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusyId(null);
    }
  };

  const reviewCandidate = async (id: string, decision: "approve" | "reject") => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/master-mentor/memory/candidates/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal review kandidat");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-5">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[#9CA3AF] uppercase">
          Phase 5
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111827]">
          Approval Center
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Setiap approval hanya berlaku untuk satu aksi. Tidak ada izin silang.
        </p>
      </header>

      <div className="mb-4">
        <PhaseBanner message="Mentor boleh mengusulkan aksi dan memory candidates. Eksekusi write ke memory hanya setelah Anda approve. Pesan eksternal & transaksi operasional tetap ditahan sampai Phase 6." />
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
          {error}
        </div>
      ) : null}
      {notice ? <p className="mb-3 text-xs text-[#B45309]">{notice}</p> : null}

      <SectionCard title="Pending actions" subtitle={`${actions.length} menunggu`}>
        {actions.length === 0 ? (
          <p className="text-sm text-[#6B7280]">Tidak ada aksi pending.</p>
        ) : (
          <ul className="space-y-3">
            {actions.map((a) => (
              <li key={a.id} className="rounded-xl border border-[#E5E7EB] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111827]">{a.title}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wide text-[#9CA3AF]">
                      {a.action_type} · risk {a.risk_level} · expires{" "}
                      {new Date(a.expires_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => reviewAction(a.id, "approve")}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#111827] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => reviewAction(a.id, "reject")}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#4B5563] disabled:opacity-40"
                    >
                      <X size={12} /> Reject
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-[#374151] whitespace-pre-wrap">{a.description}</p>
                {a.expected_impact ? (
                  <p className="mt-2 text-xs text-[#6B7280]">Impact: {a.expected_impact}</p>
                ) : null}
                <p className="mt-1 text-xs text-[#9CA3AF]">
                  Permissions: {(a.requested_permissions || []).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="mt-4">
        <SectionCard title="Pending memory candidates" subtitle={`${candidates.length} menunggu`}>
          {candidates.length === 0 ? (
            <p className="text-sm text-[#6B7280]">Tidak ada kandidat memori pending.</p>
          ) : (
            <ul className="space-y-3">
              {candidates.map((c) => (
                <li key={c.id} className="rounded-xl border border-[#E5E7EB] px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">
                        {c.memory_kind} · {c.classification}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF]">{c.source_ref}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => reviewCandidate(c.id, "approve")}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#111827] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        <ShieldCheck size={12} /> Approve & promote
                      </button>
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => reviewCandidate(c.id, "reject")}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#4B5563] disabled:opacity-40"
                      >
                        <X size={12} /> Reject
                      </button>
                    </div>
                  </div>
                  <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-[#F9FAFB] p-2 text-[11px] text-[#4B5563]">
                    {JSON.stringify(c.proposed_payload || {}, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
