"use client";

import { useMemo, useState } from "react";
import { Briefcase, Pencil, Plus, Trash2 } from "lucide-react";
import {
  BUSINESS_CATEGORIES,
  BUSINESS_STATUSES,
  categoryLabel,
  statusLabel,
  type MentorPortfolioBusiness,
} from "@/lib/master-mentor/types";
import EmptyState from "../components/empty-state";
import PhaseBanner from "../components/phase-banner";
import SectionCard from "../components/section-card";

type Notice = { kind: string; message?: string };

type FormState = {
  name: string;
  category: string;
  description: string;
  status: string;
  targets: string;
};

const emptyForm = (): FormState => ({
  name: "",
  category: "perfume",
  description: "",
  status: "draft",
  targets: "",
});

export default function PortfolioClient({
  initialRows,
  notice,
}: {
  initialRows: MentorPortfolioBusiness[];
  notice: Notice;
}) {
  const [rows, setRows] = useState(initialRows);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tableReady = notice.kind !== "missing_table";

  const title = useMemo(
    () => (editingId ? "Edit business" : "Add business"),
    [editingId],
  );

  const beginCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm(),
      name: rows.length === 0 ? "HENIMA Perfume" : "",
      category: "perfume",
      description:
        rows.length === 0
          ? "Fragrance brand under the HENIMA portfolio. Complete details before activating."
          : "",
      status: "draft",
    });
    setOpenForm(true);
    setError(null);
  };

  const beginEdit = (row: MentorPortfolioBusiness) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      category: row.category,
      description: row.description,
      status: row.status,
      targets: row.targets,
    });
    setOpenForm(true);
    setError(null);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const endpoint = editingId
        ? `/api/master-mentor/portfolio/${editingId}`
        : "/api/master-mentor/portfolio";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan.");
        return;
      }
      const business = data.business as MentorPortfolioBusiness;
      setRows((prev) => {
        if (editingId) return prev.map((r) => (r.id === editingId ? business : r));
        return [...prev, business];
      });
      setOpenForm(false);
      setEditingId(null);
      setForm(emptyForm());
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Hapus bisnis ini dari portfolio HENIMA AI?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/master-mentor/portfolio/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Gagal menghapus.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
            Business Portfolio
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Manage businesses mentored by HENIMA AI. Structure is ready for HENIMA Perfume as
            business #1.
          </p>
        </div>
        <button
          type="button"
          onClick={beginCreate}
          disabled={!tableReady || busy}
          className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          <Plus size={15} />
          Add business
        </button>
      </header>

      <div className="mb-5 space-y-3">
        <PhaseBanner message="Portfolio CRUD is owner-only and server-validated. No sample businesses are preloaded." />
        {notice.kind === "missing_table" ? (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
            {notice.message}
          </div>
        ) : null}
        {notice.kind === "error" ? (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
            {notice.message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
            {error}
          </div>
        ) : null}
      </div>

      {openForm ? (
        <SectionCard title={title} subtitle="Name, category, description, status, targets">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-[#4B5563] sm:col-span-2">
              Business name
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={120}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#9CA3AF]"
                placeholder="HENIMA Perfume"
              />
            </label>
            <label className="block text-xs font-medium text-[#4B5563]">
              Category
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#9CA3AF]"
              >
                {BUSINESS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-[#4B5563]">
              Status
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#9CA3AF]"
              >
                {BUSINESS_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-[#4B5563] sm:col-span-2">
              Description
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                maxLength={2000}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#9CA3AF]"
                placeholder="Short description of the business"
              />
            </label>
            <label className="block text-xs font-medium text-[#4B5563] sm:col-span-2">
              Business targets
              <textarea
                value={form.targets}
                onChange={(e) => setForm((f) => ({ ...f, targets: e.target.value }))}
                rows={3}
                maxLength={2000}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#9CA3AF]"
                placeholder="e.g. Launch SKU set, monthly revenue goal, distribution targets"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy || !form.name.trim()}
              className="rounded-lg bg-[#111827] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenForm(false);
                setEditingId(null);
                setForm(emptyForm());
              }}
              className="rounded-lg border border-[#E5E7EB] px-3.5 py-2 text-sm font-medium text-[#4B5563]"
            >
              Cancel
            </button>
          </div>
        </SectionCard>
      ) : null}

      <div className={openForm ? "mt-4" : ""}>
        {rows.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Portfolio is empty"
            description="No businesses registered yet. You can add HENIMA Perfume as the first business when you are ready. Nothing is invented on your behalf."
            action={
              tableReady ? (
                <button
                  type="button"
                  onClick={beginCreate}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-3.5 py-2 text-xs font-medium text-white"
                >
                  <Plus size={14} />
                  Add HENIMA Perfume
                </button>
              ) : null
            }
          />
        ) : (
          <div className="grid gap-3">
            {rows.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-[#111827]">{row.name}</h2>
                      <span className="rounded-md border border-[#E5E7EB] px-2 py-0.5 text-[11px] font-medium text-[#4B5563]">
                        {statusLabel(row.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#6B7280]">
                      {categoryLabel(row.category)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => beginEdit(row)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB]"
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#FECACA] px-2.5 py-1.5 text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2]"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">
                  {row.description || "No description provided."}
                </p>
                <div className="mt-3 rounded-lg border border-[#F3F4F6] bg-[#FAFAFA] px-3 py-2.5">
                  <p className="text-[11px] font-semibold tracking-wide text-[#9CA3AF] uppercase">
                    Targets
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#4B5563]">
                    {row.targets || "No targets set."}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
