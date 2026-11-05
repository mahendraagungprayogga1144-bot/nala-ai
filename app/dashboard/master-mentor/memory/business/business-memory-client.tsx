"use client";

import { useMemo, useState } from "react";
import type { BusinessMemoryProfile } from "@/lib/master-mentor/memory-types";
import { BUSINESS_CATEGORIES, BUSINESS_STATUSES, categoryLabel, statusLabel } from "@/lib/master-mentor/types";
import EmptyState from "../../components/empty-state";
import PhaseBanner from "../../components/phase-banner";
import SectionCard from "../../components/section-card";
import { Briefcase } from "lucide-react";
import {
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


export default function BusinessMemoryClient({
  initial,
  notice,
}: {
  initial: BusinessMemoryProfile[];
  notice: string | null;
}) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState(initial[0]?.id || "");
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);
  const [form, setForm] = useState<BusinessMemoryProfile | null>(selected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (row: BusinessMemoryProfile) => {
    setSelectedId(row.id);
    setForm(row);
    setError(null);
  };

  const search = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await apiJson<{ businesses: BusinessMemoryProfile[]; notice?: string }>(
        `/api/master-mentor/memory/business?q=${encodeURIComponent(q)}`,
      );
      setRows(data.businesses);
      if (data.businesses[0]) pick(data.businesses[0]);
      else setForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiJson<{ business: BusinessMemoryProfile }>(
        `/api/master-mentor/memory/business/${form.id}`,
        { method: "PUT", body: JSON.stringify(form) },
      );
      setRows((prev) => prev.map((r) => (r.id === data.business.id ? data.business : r)));
      setForm(data.business);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[#111827]">Info bisnis</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Profil per bisnis. HENIMA Perfume boleh jadi yang pertama — tidak harus satu-satunya.
        </p>
      </header>
      <div className="mb-5 space-y-3">
        <PhaseBanner message="Buat bisnis di Bisnis Saya dulu, baru lengkapi info di sini." />
        {notice ? <ErrorBox message={notice} /> : null}
        <ErrorBox message={error} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search business knowledge…"
          className="max-w-sm"
        />
        <GhostButton type="button" onClick={search} disabled={busy}>
          Search
        </GhostButton>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No business knowledge yet"
          description="Add a business in Business Portfolio, then return here to complete its knowledge profile."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="space-y-1">
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => pick(r)}
                className={[
                  "w-full rounded-lg border px-3 py-2.5 text-left text-sm",
                  selectedId === r.id
                    ? "border-[#111827] bg-[#111827] text-white"
                    : "border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]",
                ].join(" ")}
              >
                <p className="font-medium">{r.name}</p>
                <p className={selectedId === r.id ? "text-white/70 text-xs" : "text-[#9CA3AF] text-xs"}>
                  {categoryLabel(r.category)} · {statusLabel(r.status)}
                </p>
              </button>
            ))}
          </div>

          {form ? (
            <SectionCard title={form.name} subtitle={`Business ID: ${form.id}`}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Business name" className="sm:col-span-2">
                  <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label="Category">
                  <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {BUSINESS_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{categoryLabel(c)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {BUSINESS_STATUSES.map((s) => (
                      <option key={s} value={s}>{statusLabel(s)}</option>
                    ))}
                  </Select>
                </Field>
                {(
                  [
                    ["description", "Description"],
                    ["business_model", "Business model"],
                    ["products_services", "Products and services"],
                    ["target_customers", "Target customers"],
                    ["sales_channels", "Sales channels"],
                    ["operational_structure", "Operational structure"],
                    ["business_goals", "Business goals"],
                    ["targets", "Targets (legacy/short)"],
                    ["current_challenges", "Current challenges"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label} className="sm:col-span-2">
                    <TextArea
                      rows={2}
                      value={form[key] || ""}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </Field>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <PrimaryButton type="button" disabled={busy} onClick={save}>
                  {busy ? "Saving…" : "Save knowledge"}
                </PrimaryButton>
              </div>
              <MetaLine created={form.created_at} updated={form.updated_at} source="owner_entry" />
            </SectionCard>
          ) : null}
        </div>
      )}
    </div>
  );
}
