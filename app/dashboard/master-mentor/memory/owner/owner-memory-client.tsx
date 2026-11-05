"use client";

import { useState } from "react";
import type { OwnerMemory } from "@/lib/master-mentor/memory-types";
import PhaseBanner from "../../components/phase-banner";
import SectionCard from "../../components/section-card";
import {
  ErrorBox,
  Field,
  GhostButton,
  MetaLine,
  PrimaryButton,
  TextArea,
  apiJson,
} from "../memory-ui";

export default function OwnerMemoryClient({ initial }: { initial: OwnerMemory }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(initial.updated_at || "");

  const set = (key: keyof OwnerMemory, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await apiJson<{ memory: OwnerMemory }>("/api/master-mentor/memory/owner", {
        method: "PUT",
        body: JSON.stringify({
          business_vision: form.business_vision,
          long_term_goals: form.long_term_goals,
          communication_style: form.communication_style,
          decision_preferences: form.decision_preferences,
          business_philosophy: form.business_philosophy,
          risk_tolerance: form.risk_tolerance,
          working_preferences: form.working_preferences,
        }),
      });
      setForm(data.memory);
      setSavedAt(data.memory.updated_at);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!window.confirm("Hapus seluruh owner memory? Ini tidak bisa dibatalkan.")) return;
    setBusy(true);
    setError(null);
    try {
      await apiJson("/api/master-mentor/memory/owner", { method: "DELETE" });
      setForm({
        ...form,
        business_vision: "",
        long_term_goals: "",
        communication_style: "",
        decision_preferences: "",
        business_philosophy: "",
        risk_tolerance: "",
        working_preferences: "",
        updated_at: "",
        created_at: "",
      });
      setSavedAt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[#111827]">Owner Profile</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Only information you provide is stored. Nothing is inferred.
        </p>
      </header>
      <div className="mb-5 space-y-3">
        <PhaseBanner message="Owner memory is personal context for mentoring. Leave fields blank if not ready — blank is not a guessed value." />
        <ErrorBox message={error} />
      </div>
      <SectionCard title="Owner memory fields" subtitle="Editable by owner only">
        <div className="grid gap-3">
          <Field label="Business vision">
            <TextArea rows={3} value={form.business_vision} onChange={(e) => set("business_vision", e.target.value)} />
          </Field>
          <Field label="Long-term goals">
            <TextArea rows={3} value={form.long_term_goals} onChange={(e) => set("long_term_goals", e.target.value)} />
          </Field>
          <Field label="Preferred communication style">
            <TextArea rows={2} value={form.communication_style} onChange={(e) => set("communication_style", e.target.value)} />
          </Field>
          <Field label="Decision-making preferences">
            <TextArea rows={2} value={form.decision_preferences} onChange={(e) => set("decision_preferences", e.target.value)} />
          </Field>
          <Field label="Business philosophy">
            <TextArea rows={3} value={form.business_philosophy} onChange={(e) => set("business_philosophy", e.target.value)} />
          </Field>
          <Field label="Risk tolerance">
            <TextArea rows={2} value={form.risk_tolerance} onChange={(e) => set("risk_tolerance", e.target.value)} />
          </Field>
          <Field label="Personal working preferences">
            <TextArea rows={2} value={form.working_preferences} onChange={(e) => set("working_preferences", e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton type="button" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </PrimaryButton>
          <GhostButton type="button" disabled={busy} onClick={clear}>
            Clear all
          </GhostButton>
        </div>
        <MetaLine created={form.created_at} updated={savedAt || form.updated_at} source="owner_entry" />
      </SectionCard>
    </div>
  );
}
