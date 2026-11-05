"use client";

import { useState } from "react";
import type { MemoryCandidate } from "@/lib/master-mentor/memory-types";
import EmptyState from "../../components/empty-state";
import PhaseBanner from "../../components/phase-banner";
import { ShieldCheck } from "lucide-react";
import { DangerButton, ErrorBox, GhostButton, MetaLine, PrimaryButton, apiJson } from "../memory-ui";

export default function CandidatesClient({
  initial,
  notice,
}: {
  initial: MemoryCandidate[];
  notice: string | null;
}) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const data = await apiJson<{ candidates: MemoryCandidate[] }>(
      "/api/master-mentor/memory/candidates?status=pending",
    );
    setRows(data.candidates);
  };

  const review = async (id: string, action: "approve" | "reject" | "correct") => {
    setBusy(true);
    setError(null);
    try {
      await apiJson(`/api/master-mentor/memory/candidates/${id}`, {
        method: "POST",
        body: JSON.stringify({
          action,
          review_note: action === "approve" ? "Approved by owner" : action === "reject" ? "Rejected by owner" : "Corrected by owner",
        }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[#111827]">Menunggu OK</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Usulan dari chat harus kamu setujui dulu sebelum jadi memori tetap.
        </p>
      </header>
      <div className="mb-5 space-y-3">
        <PhaseBanner message="Chat bisa usulkan fakta / preferensi / asumsi / saran. Tidak ada yang menimpa memori lama tanpa OK kamu." />
        {notice ? <ErrorBox message={notice} /> : null}
        <ErrorBox message={error} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Belum ada yang menunggu OK"
          description="When Mentor Chat proposes a memory later, it will appear here for your approval."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="rounded-xl border border-[#E5E7EB] px-4 py-3">
              <p className="text-sm font-semibold text-[#111827]">
                {r.memory_kind} · {r.classification}
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-[#F9FAFB] p-3 text-xs text-[#374151]">
                {JSON.stringify(r.proposed_payload, null, 2)}
              </pre>
              <MetaLine created={r.created_at} source={r.source_ref || "mentor_candidate"} />
              <div className="mt-3 flex flex-wrap gap-2">
                <PrimaryButton type="button" disabled={busy} onClick={() => review(r.id, "approve")}>
                  Approve
                </PrimaryButton>
                <GhostButton type="button" disabled={busy} onClick={() => review(r.id, "correct")}>
                  Mark corrected
                </GhostButton>
                <DangerButton type="button" disabled={busy} onClick={() => review(r.id, "reject")}>
                  Reject
                </DangerButton>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
