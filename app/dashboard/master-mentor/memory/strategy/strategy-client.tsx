"use client";

import { useState } from "react";
import { STRATEGY_STATUSES, type StrategyRecord } from "@/lib/master-mentor/memory-types";
import EmptyState from "../../components/empty-state";
import PhaseBanner from "../../components/phase-banner";
import SectionCard from "../../components/section-card";
import { Target } from "lucide-react";
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
  business_strategy: "",
  short_term_targets: "",
  medium_term_targets: "",
  long_term_targets: "",
  growth_plans: "",
  expansion_plans: "",
  marketing_strategies: "",
  operational_strategies: "",
  milestones: "",
  status: "draft",
});

export default function StrategyClient({
  businesses,
  initial,
  notice,
}: {
  businesses: Biz[];
  initial: StrategyRecord[];
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
    const data = await apiJson<{ strategies: StrategyRecord[] }>(
      `/api/master-mentor/memory/strategies?${params}`,
    );
    setRows(data.strategies);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        await apiJson(`/api/master-mentor/memory/strategies/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        await apiJson("/api/master-mentor/memory/strategies", {
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
    if (!window.confirm("Hapus strategic plan ini?")) return;
    setBusy(true);
    try {
      await apiJson(`/api/master-mentor/memory/strategies/${id}`, { method: "DELETE" });
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
          <h1 className="text-2xl font-semibold text-[#111827]">Strategic Plans</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Draft · Active · Completed · Paused · Cancelled</p>
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
          Add plan
        </PrimaryButton>
      </header>
      <div className="mb-5 space-y-3">
        <PhaseBanner message="Strategic memory is structured owner input — not AI-generated plans." />
        {notice ? <ErrorBox message={notice} /> : null}
        <ErrorBox message={error} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={bizId} onChange={(e) => setBizId(e.target.value)} className="max-w-xs">
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search plans…" className="max-w-xs" />
        <GhostButton type="button" disabled={busy} onClick={() => reload().catch((e) => setError(String(e.message || e)))}>
          Search
        </GhostButton>
      </div>

      {open ? (
        <div className="mb-4">
          <SectionCard title={editingId ? "Edit plan" : "New strategic plan"}>
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
                  {STRATEGY_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Title" className="sm:col-span-2">
                <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              {(
                [
                  ["business_strategy", "Business strategy"],
                  ["short_term_targets", "Short-term targets"],
                  ["medium_term_targets", "Medium-term targets"],
                  ["long_term_targets", "Long-term targets"],
                  ["growth_plans", "Growth plans"],
                  ["expansion_plans", "Expansion plans"],
                  ["marketing_strategies", "Marketing strategies"],
                  ["operational_strategies", "Operational strategies"],
                  ["milestones", "Strategic milestones"],
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
        <EmptyState icon={Target} title="No strategic plans" description="Add a plan when you are ready. Status starts as draft." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="rounded-xl border border-[#E5E7EB] px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{r.title}</p>
                  <p className="text-xs text-[#6B7280]">{r.status}</p>
                  <p className="mt-2 text-sm text-[#4B5563]">{r.business_strategy || r.short_term_targets || "—"}</p>
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
                        business_strategy: r.business_strategy,
                        short_term_targets: r.short_term_targets,
                        medium_term_targets: r.medium_term_targets,
                        long_term_targets: r.long_term_targets,
                        growth_plans: r.growth_plans,
                        expansion_plans: r.expansion_plans,
                        marketing_strategies: r.marketing_strategies,
                        operational_strategies: r.operational_strategies,
                        milestones: r.milestones,
                        status: r.status,
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
