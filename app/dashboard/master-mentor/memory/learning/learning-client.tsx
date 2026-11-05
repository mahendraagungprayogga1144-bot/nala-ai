"use client";

import { useState } from "react";
import { LEARNING_SOURCES, type LearningRecord } from "@/lib/master-mentor/memory-types";
import EmptyState from "../../components/empty-state";
import PhaseBanner from "../../components/phase-banner";
import SectionCard from "../../components/section-card";
import { Lightbulb } from "lucide-react";
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
  related_decision_id: "",
  lesson: "",
  evidence: "",
  source: "owner_entry",
  recorded_date: new Date().toISOString().slice(0, 10),
});

export default function LearningClient({
  businesses,
  initial,
  notice,
}: {
  businesses: Biz[];
  initial: LearningRecord[];
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
    const data = await apiJson<{ learnings: LearningRecord[] }>(
      `/api/master-mentor/memory/learnings?${params}`,
    );
    setRows(data.learnings);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        related_decision_id: form.related_decision_id.trim() || null,
      };
      if (editingId) {
        await apiJson(`/api/master-mentor/memory/learnings/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiJson("/api/master-mentor/memory/learnings", {
          method: "POST",
          body: JSON.stringify(payload),
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
    if (!window.confirm("Hapus learning record ini?")) return;
    setBusy(true);
    try {
      await apiJson(`/api/master-mentor/memory/learnings/${id}`, { method: "DELETE" });
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
          <h1 className="text-2xl font-semibold text-[#111827]">Learning History</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Lessons with evidence. Do not store AI assumptions as facts.
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
          Add learning
        </PrimaryButton>
      </header>
      <div className="mb-5 space-y-3">
        <PhaseBanner message="Each learning should cite evidence. Optional link to a related decision in the same business." />
        {notice ? <ErrorBox message={notice} /> : null}
        <ErrorBox message={error} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={bizId} onChange={(e) => setBizId(e.target.value)} className="max-w-xs">
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lessons…" className="max-w-xs" />
        <GhostButton type="button" disabled={busy} onClick={() => reload().catch((e) => setError(String(e.message || e)))}>
          Search
        </GhostButton>
      </div>

      {open ? (
        <div className="mb-4">
          <SectionCard title={editingId ? "Edit learning" : "New learning"}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Business">
                <Select value={form.business_id} onChange={(e) => setForm({ ...form, business_id: e.target.value })}>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Source">
                <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  {LEARNING_SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Related decision ID (optional)" className="sm:col-span-2">
                <TextInput
                  value={form.related_decision_id}
                  onChange={(e) => setForm({ ...form, related_decision_id: e.target.value })}
                  placeholder="UUID from Decision History"
                />
              </Field>
              <Field label="Recorded date">
                <TextInput type="date" value={form.recorded_date} onChange={(e) => setForm({ ...form, recorded_date: e.target.value })} />
              </Field>
              <Field label="Lesson" className="sm:col-span-2">
                <TextArea rows={3} value={form.lesson} onChange={(e) => setForm({ ...form, lesson: e.target.value })} />
              </Field>
              <Field label="Evidence" className="sm:col-span-2">
                <TextArea rows={3} value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} />
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <PrimaryButton type="button" disabled={busy || !form.lesson.trim()} onClick={save}>
                {busy ? "Saving…" : "Save"}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState icon={Lightbulb} title="No learnings yet" description="Capture lessons after reviewing decision outcomes." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="rounded-xl border border-[#E5E7EB] px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{r.lesson}</p>
                  <p className="mt-1 text-sm text-[#4B5563]">Evidence: {r.evidence || "—"}</p>
                  <MetaLine created={r.created_at} updated={r.updated_at} source={r.source} />
                </div>
                <div className="flex gap-2">
                  <GhostButton
                    type="button"
                    onClick={() => {
                      setEditingId(r.id);
                      setForm({
                        business_id: r.business_id,
                        related_decision_id: r.related_decision_id || "",
                        lesson: r.lesson,
                        evidence: r.evidence,
                        source: r.source,
                        recorded_date: r.recorded_date,
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
