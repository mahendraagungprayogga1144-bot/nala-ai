"use client";

import { useState } from "react";
import {
  FINANCIAL_CERTAINTIES,
  FINANCIAL_METRIC_TYPES,
  metricLabel,
  type FinancialRecord,
} from "@/lib/master-mentor/memory-types";
import EmptyState from "../../components/empty-state";
import PhaseBanner from "../../components/phase-banner";
import SectionCard from "../../components/section-card";
import { LineChart } from "lucide-react";
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

const emptyForm = (businessId: string) => ({
  business_id: businessId,
  metric_type: "revenue",
  amount: "",
  currency: "IDR",
  transaction_date: new Date().toISOString().slice(0, 10),
  transaction_category: "",
  description: "",
  data_source: "owner_entry",
  certainty: "estimate",
});

export default function FinancialMemoryClient({
  businesses,
  initial,
  notice,
}: {
  businesses: Biz[];
  initial: FinancialRecord[];
  notice: string | null;
}) {
  const [rows, setRows] = useState(initial);
  const [bizId, setBizId] = useState(businesses[0]?.id || "");
  const [q, setQ] = useState("");
  const [certainty, setCertainty] = useState("");
  const [form, setForm] = useState(emptyForm(businesses[0]?.id || ""));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const params = new URLSearchParams();
    if (bizId) params.set("businessId", bizId);
    if (q) params.set("q", q);
    if (certainty) params.set("certainty", certainty);
    const data = await apiJson<{ records: FinancialRecord[] }>(
      `/api/master-mentor/memory/financial?${params}`,
    );
    setRows(data.records);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editingId) {
        await apiJson(`/api/master-mentor/memory/financial/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiJson("/api/master-mentor/memory/financial", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm(bizId));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Hapus financial record ini?")) return;
    setBusy(true);
    setError(null);
    try {
      await apiJson(`/api/master-mentor/memory/financial/${id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  /** One-tap starter from numbers the owner already said in Mentor Chat (estimate). */
  const seedFromChatStory = async () => {
    if (!bizId) return;
    if (
      !window.confirm(
        "Simpan 3 angka estimate dari cerita chat?\n• Omzet 16.000.000\n• Saldo kas 2.000.000\n• Tarik pribadi / rumah 5.000.000",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const today = new Date().toISOString().slice(0, 10);
    const seeds = [
      {
        business_id: bizId,
        metric_type: "revenue",
        amount: 16_000_000,
        currency: "IDR",
        transaction_date: today,
        transaction_category: "omzet_3_bulan",
        description: "Omzet ~16jt dari chat owner (143 produk / 3 bulan) — estimate",
        data_source: "owner_entry",
        certainty: "estimate",
      },
      {
        business_id: bizId,
        metric_type: "cash_balance",
        amount: 2_000_000,
        currency: "IDR",
        transaction_date: today,
        transaction_category: "saldo_kas",
        description: "Sisa uang bisnis ~2jt dari chat owner — estimate",
        data_source: "owner_entry",
        certainty: "estimate",
      },
      {
        business_id: bizId,
        metric_type: "operating_expenses",
        amount: 5_000_000,
        currency: "IDR",
        transaction_date: today,
        transaction_category: "owner_draw_rumah",
        description: "Tarik pribadi / bayar rumah ~5jt dari chat owner — estimate",
        data_source: "owner_entry",
        certainty: "estimate",
      },
    ];
    try {
      for (const payload of seeds) {
        await apiJson("/api/master-mentor/memory/financial", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan starter");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#111827]">Catatan Keuangan</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Angka resmi bisnis. Mentor Chat tidak mengisi halaman ini otomatis — isi di sini, baru chat lagi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {rows.length === 0 && bizId ? (
            <GhostButton type="button" disabled={busy} onClick={seedFromChatStory}>
              Isi 3 angka dari chat
            </GhostButton>
          ) : null}
          <PrimaryButton
            type="button"
            disabled={!bizId}
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm(bizId));
              setOpen(true);
            }}
          >
            Tambah catatan
          </PrimaryButton>
        </div>
      </header>

      <div className="mb-5 space-y-3">
        <PhaseBanner message="Kosong = belum diisi owner. AI tidak mengarang angka. Pilih estimate kalau belum pasti." />
        {notice ? <ErrorBox message={notice} /> : null}
        <ErrorBox message={error} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={bizId} onChange={(e) => setBizId(e.target.value)} className="max-w-xs">
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
        <Select value={certainty} onChange={(e) => setCertainty(e.target.value)} className="max-w-[160px]">
          <option value="">All certainty</option>
          {FINANCIAL_CERTAINTIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="max-w-xs" />
        <GhostButton type="button" disabled={busy} onClick={() => reload().catch((e) => setError(String(e.message || e)))}>
          Filter
        </GhostButton>
      </div>

      {open ? (
        <div className="mb-4">
          <SectionCard title={editingId ? "Edit catatan" : "Catatan baru"}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Bisnis">
                <Select value={form.business_id} onChange={(e) => setForm({ ...form, business_id: e.target.value })}>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Jenis angka">
                <Select value={form.metric_type} onChange={(e) => setForm({ ...form, metric_type: e.target.value })}>
                  {FINANCIAL_METRIC_TYPES.map((m) => (
                    <option key={m} value={m}>{metricLabel(m)}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Nominal (Rp)">
                <TextInput type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="16000000" />
              </Field>
              <Field label="Tanggal">
                <TextInput type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} />
              </Field>
              <Field label="Kepastian">
                <Select value={form.certainty} onChange={(e) => setForm({ ...form, certainty: e.target.value })}>
                  {FINANCIAL_CERTAINTIES.map((c) => (
                    <option key={c} value={c}>
                      {c === "actual" ? "actual (pasti)" : c === "estimate" ? "estimate (perkiraan)" : "projection (proyeksi)"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kategori">
                <TextInput value={form.transaction_category} onChange={(e) => setForm({ ...form, transaction_category: e.target.value })} placeholder="omzet / saldo / pribadi" />
              </Field>
              <Field label="Keterangan" className="sm:col-span-2">
                <TextArea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <PrimaryButton type="button" disabled={busy} onClick={save}>{busy ? "Menyimpan…" : "Simpan"}</PrimaryButton>
              <GhostButton type="button" onClick={() => setOpen(false)}>Batal</GhostButton>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="Belum ada catatan keuangan"
          description="Ini normal kalau baru dibuka. Ketik angka di Mentor Chat tidak otomatis masuk ke sini. Klik «Isi 3 angka dari chat» di atas, atau «Tambah catatan» manual."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="rounded-xl border border-[#E5E7EB] px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#111827]">
                    {metricLabel(r.metric_type)} · {r.amount.toLocaleString("id-ID")} {r.currency}
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {r.transaction_date} · {r.certainty} · {r.transaction_category || "uncategorized"}
                  </p>
                  <p className="mt-1 text-sm text-[#4B5563]">{r.description || "No description"}</p>
                  <MetaLine created={r.created_at} updated={r.updated_at} source={r.data_source} />
                </div>
                <div className="flex gap-2">
                  <GhostButton
                    type="button"
                    onClick={() => {
                      setEditingId(r.id);
                      setForm({
                        business_id: r.business_id,
                        metric_type: r.metric_type,
                        amount: String(r.amount),
                        currency: r.currency,
                        transaction_date: r.transaction_date,
                        transaction_category: r.transaction_category,
                        description: r.description,
                        data_source: r.data_source,
                        certainty: r.certainty,
                      });
                      setOpen(true);
                    }}
                  >
                    Edit
                  </GhostButton>
                  <DangerButton type="button" disabled={busy} onClick={() => remove(r.id)}>
                    Delete
                  </DangerButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
