"use client";

import { useState } from "react";
import { DECISION_STATUSES, type DecisionRecord } from "@/lib/master-mentor/memory-types";
import EmptyState from "../../components/empty-state";
import PhaseBanner from "../../components/phase-banner";
import SectionCard from "../../components/section-card";
import { ClipboardList } from "lucide-react";
import {
  DangerButton,
  ErrorBox,
  Field,
  GhostButton,
  MetaLine,
  PrimaryButton,
  Select,
  TextArea,
  TextInput,
  apiJson,
} from "../memory-ui";

type Biz = { id: string; name: string };

const blank = (businessId: string) => ({
  business_id: businessId,
  title: "",
  description: "",
  reasoning: "",
  alternatives: "",
  expected_outcome: "",
  risks: "",
  decision_date: new Date().toISOString().slice(0, 10),
  status: "proposed",
  actual_outcome: "",
  review_notes: "",
});

export default function DecisionsClient({
  businesses,
  initial,
  notice,
}: {
  businesses: Biz[];
  initial: DecisionRecord[];
  notice: string | null;
}) {
  const [rows, setRows] = useState(initial);
  const [bizId, setBizId] = useState(businesses[0]?.id || "");
  const [q, setQ] = useState("");
  const [form, setForm] = useState(blank(businesses[0]?.id || ""));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const params = new URLSearchParams();
    if (bizId) params.set("businessId", bizId);
    if (q) params.set("q", q);
    const data = await apiJson<{ decisions: DecisionRecord[] }>(
      `/api/master-mentor/memory/decisions?${params}`,
    );
    setRows(data.decisions);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        await apiJson(`/api/master-mentor/memory/decisions/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        await apiJson("/api/master-mentor/memory/decisions", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      setOpen(false);
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Hapus keputusan ini?")) return;
    setBusy(true);
    try {
      await apiJson(`/api/master-mentor/memory/decisions/${id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#111827]">Decision History</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Compare expected vs actual outcomes. Never invent decision history.
          </p>
        </div>
        <PrimaryButton
          type="button"
          disabled={!bizId}
          onClick={() => {
            setEditingId(null);
            setForm(blank(bizId));
            setOpen(true);
          }}
        >
          Add decision
        </PrimaryButton>
      </header>
      <div className="mb-5 space-y-3">
        <PhaseBanner message="Decision memory is owner-authored. Mentor retrieval will cite these records with sources." />
        {notice ? <ErrorBox message={notice} /> : null}
        <ErrorBox message={error} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={bizId} onChange={(e) => setBizId(e.target.value)} className="max-w-xs">
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search decisions…" className="max-w-xs" />
        <GhostButton type="button" disabled={busy} onClick={() => reload().catch((e) => setError(String(e.message || e)))}>
          Search
        </GhostButton>
      </div>

      {open ? (
        <div className="mb-4">
          <SectionCard title={editingId ? "Edit decision" : "New decision"}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Business">
                <Select value={form.business_id} onChange={(e) => setForm({ ...form, business_id: e.target.value })}>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {DECISION_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Title" className="sm:col-span-2">
                <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              <Field label="Decision date">
                <TextInput type="date" value={form.decision_date} onChange={(e) => setForm({ ...form, decision_date: e.target.value })} />
              </Field>
              {(
                [
                  ["description", "Description"],
                  ["reasoning", "Reasoning"],
                  ["alternatives", "Alternatives considered"],
                  ["expected_outcome", "Expected outcome"],
                  ["risks", "Risks"],
                  ["actual_outcome", "Actual outcome"],
                  ["review_notes", "Review notes"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label} className="sm:col-span-2">
                  <TextArea rows={2} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                </Field>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <PrimaryButton type="button" disabled={busy || !form.title.trim()} onClick={save}>
                {busy ? "Saving…" : "Save"}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No decisions logged" description="Record decisions and later fill actual outcomes for comparison." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="rounded-xl border border-[#E5E7EB] px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111827]">{r.title}</p>
                  <p className="text-xs text-[#6B7280]">{r.decision_date} · {r.status}</p>
                  <p className="mt-2 text-sm text-[#4B5563]">{r.description || r.reasoning || "—"}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-[#F3F4F6] bg-[#FAFAFA] px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Expected</p>
                      <p className="mt-1 text-sm text-[#4B5563]">{r.expected_outcome || "Not set"}</p>
                    </div>
                    <div className="rounded-lg border border-[#F3F4F6] bg-[#FAFAFA] px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Actual</p>
                      <p className="mt-1 text-sm text-[#4B5563]">{r.actual_outcome || "Not reviewed yet"}</p>
                    </div>
                  </div>
                  <MetaLine created={r.created_at} updated={r.updated_at} source="owner_entry" />
                </div>
                <div className="flex gap-2">
                  <GhostButton
                    type="button"
                    onClick={() => {
                      setEditingId(r.id);
                      setForm({
                        business_id: r.business_id,
                        title: r.title,
                        description: r.description,
                        reasoning: r.reasoning,
                        alternatives: r.alternatives,
                        expected_outcome: r.expected_outcome,
                        risks: r.risks,
                        decision_date: r.decision_date,
                        status: r.status,
                        actual_outcome: r.actual_outcome,
                        review_notes: r.review_notes,
                      });
                      setOpen(true);
                    }}
                  >
                    Edit
                  </GhostButton>
                  <DangerButton type="button" disabled={busy} onClick={() => remove(r.id)}>Delete</DangerButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
