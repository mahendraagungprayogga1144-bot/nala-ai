"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";

const GOLD = "#C5A358";

type Tab = "karyawan" | "bonus" | "slip";

type Employee = {
  id: string;
  nama: string;
  role: string;
  status: string;
  joinedAt: string | null;
  baseSalary: number;
  payDay: number;
  bankAccount: string | null;
  employmentNote: string | null;
};

type BonusRule = {
  id: string;
  name: string;
  kind: "target_pct" | "fixed";
  minAchievementPct: number;
  bonusAmount: number;
  active: boolean;
};

type PayrollLine = {
  id: string;
  salesName: string;
  baseSalary: number;
  commission: number;
  targetBonus: number;
  deduction: number;
  total: number;
  achievementPct: number;
  payDay?: number;
  bankAccount?: string | null;
  note?: string | null;
};

type PayrollRun = {
  id: string;
  periodYm: string;
  payDate: string;
  status: "draft" | "paid" | "void";
  lines: PayrollLine[];
  totals: { base: number; commission: number; bonus: number; deduction: number; total: number };
};

function rp(n: number) {
  return `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
}

function initials(nama: string) {
  return (
    nama
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

function statusLabel(status: PayrollRun["status"]) {
  if (status === "paid") return "Sudah dibayar";
  if (status === "void") return "Dibatalkan";
  return "Belum dibayar";
}

export default function TrackingHr({
  ownerName,
  canEdit,
  canManagePayroll,
  employees: initialEmployees,
  bonusRules: initialRules,
  payrollRuns: initialRuns,
  defaultPeriod,
}: {
  ownerName: string;
  canEdit: boolean;
  canManagePayroll: boolean;
  employees: Employee[];
  bonusRules: BonusRule[];
  payrollRuns: PayrollRun[];
  defaultPeriod: string;
}) {
  const [tab, setTab] = useState<Tab>("karyawan");
  const [employees, setEmployees] = useState(initialEmployees);
  const [bonusRules, setBonusRules] = useState(initialRules);
  const [payrollRuns, setPayrollRuns] = useState(initialRuns);
  const [periodYm, setPeriodYm] = useState(defaultPeriod);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const editing = employees.find((e) => e.id === editId) || null;
  const [joinedAt, setJoinedAt] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [payDay, setPayDay] = useState("25");
  const [bankAccount, setBankAccount] = useState("");
  const [employmentNote, setEmploymentNote] = useState("");

  const [bonusEditId, setBonusEditId] = useState<string | null>(null);
  const [bonusName, setBonusName] = useState("Bonus target 100%");
  const [bonusAmount, setBonusAmount] = useState("500000");
  const [bonusMin, setBonusMin] = useState("100");

  const [openRunId, setOpenRunId] = useState(payrollRuns[0]?.id || "");
  const [editLineId, setEditLineId] = useState<string | null>(null);
  const [lineBase, setLineBase] = useState("");
  const [lineCommission, setLineCommission] = useState("");
  const [lineBonus, setLineBonus] = useState("");
  const [lineDeduction, setLineDeduction] = useState("");

  const openRun = payrollRuns.find((r) => r.id === openRunId) || payrollRuns[0] || null;
  const editingLine =
    openRun?.lines.find((l) => l.id === editLineId) ||
    payrollRuns.flatMap((r) => r.lines).find((l) => l.id === editLineId) ||
    null;

  function openEdit(emp: Employee) {
    setEditId(emp.id);
    setEditLineId(null);
    setJoinedAt(emp.joinedAt || "");
    setBaseSalary(emp.baseSalary ? String(emp.baseSalary) : "");
    setPayDay(String(emp.payDay || 25));
    setBankAccount(emp.bankAccount || "");
    setEmploymentNote(emp.employmentNote || "");
    setError("");
    setOk("");
  }

  function openLineEdit(line: PayrollLine) {
    setEditLineId(line.id);
    setEditId(null);
    setLineBase(String(line.baseSalary || 0));
    setLineCommission(String(line.commission || 0));
    setLineBonus(String(line.targetBonus || 0));
    setLineDeduction(String(line.deduction || 0));
    setError("");
    setOk("");
  }

  function openBonusEdit(rule: BonusRule) {
    setBonusEditId(rule.id);
    setBonusName(rule.name);
    setBonusMin(String(rule.minAchievementPct));
    setBonusAmount(String(rule.bonusAmount));
    setError("");
    setOk("");
  }

  function resetBonusForm() {
    setBonusEditId(null);
    setBonusName("Bonus target 100%");
    setBonusMin("100");
    setBonusAmount("500000");
  }

  async function post(body: Record<string, unknown>, keepRunId = openRunId) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/sales/hr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan.");
      if (json.employees) setEmployees(json.employees);
      if (json.bonusRules) setBonusRules(json.bonusRules);
      if (json.payrollRuns) {
        setPayrollRuns(json.payrollRuns);
        const still = json.payrollRuns.find((r: PayrollRun) => r.id === keepRunId);
        setOpenRunId(still?.id || json.payrollRuns[0]?.id || "");
      }
      return json;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function saveEmployee() {
    if (!editId) return;
    try {
      const body: Record<string, unknown> = {
        action: "update_employee",
        staffId: editId,
        joinedAt: joinedAt || null,
        bankAccount: bankAccount || null,
        employmentNote: employmentNote || null,
      };
      if (canManagePayroll) {
        body.baseSalary = Number(baseSalary || 0);
        body.payDay = Number(payDay || 25);
      }
      await post(body);
      setOk("Data gaji tersimpan.");
      setEditId(null);
    } catch {
      /* shown */
    }
  }

  async function saveBonus() {
    if (!canManagePayroll) return;
    const min = Number(bonusMin || 0);
    const amount = Number(bonusAmount || 0);
    if (!bonusName.trim()) {
      setError("Nama aturan wajib diisi.");
      return;
    }
    if (!Number.isFinite(min) || min < 0 || min > 200) {
      setError("Min. target % harus antara 0–200.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Nominal bonus tidak valid.");
      return;
    }
    try {
      await post({
        action: "upsert_bonus",
        id: bonusEditId,
        name: bonusName,
        kind: "target_pct",
        minAchievementPct: min,
        bonusAmount: amount,
        active: true,
      });
      setOk(bonusEditId ? "Aturan bonus diubah." : "Aturan bonus ditambah.");
      resetBonusForm();
    } catch {
      /* shown */
    }
  }

  async function removeBonus(ruleId: string, name: string) {
    if (!canManagePayroll) return;
    if (!window.confirm(`Hapus aturan “${name}”?`)) return;
    try {
      await post({ action: "delete_bonus", ruleId });
      if (bonusEditId === ruleId) resetBonusForm();
      setOk("Aturan bonus dihapus.");
    } catch {
      /* shown */
    }
  }

  async function generate() {
    if (!canManagePayroll) return;
    const incomplete = employees.filter((e) => e.status === "active" && (!e.joinedAt || !e.baseSalary));
    if (incomplete.length) {
      const names = incomplete
        .slice(0, 4)
        .map((e) => e.nama)
        .join(", ");
      const more = incomplete.length > 4 ? ` (+${incomplete.length - 4} lain)` : "";
      if (
        !window.confirm(
          `${incomplete.length} sales belum lengkap data gaji (${names}${more}). Tetap buat slip? Yang kosong tetap keluar Rp 0.`,
        )
      ) {
        return;
      }
    }
    const existing = payrollRuns.find((r) => r.periodYm === periodYm);
    if (existing?.status === "draft") {
      if (
        !window.confirm(
          `Slip ${periodYm} sudah ada (draft). Buat ulang akan menimpa semua ubahan manual di periode ini. Lanjut?`,
        )
      ) {
        return;
      }
    }
    if (existing?.status === "paid") {
      setError(`Periode ${periodYm} sudah dibayar — tidak bisa dibuat ulang.`);
      return;
    }
    try {
      await post({ action: "generate_payroll", periodYm });
      setOk(`Slip ${periodYm} siap. Satu bill per sales.`);
      setTab("slip");
    } catch {
      /* shown */
    }
  }

  async function markPaid(runId: string) {
    if (!canManagePayroll) return;
    if (!window.confirm("Tandai semua slip periode ini sudah dibayar? Setelah itu tidak bisa diubah/dihapus.")) return;
    try {
      await post({ action: "mark_paid", runId }, runId);
      setOk("Semua slip periode ini ditandai sudah dibayar.");
    } catch {
      /* shown */
    }
  }

  async function saveLine() {
    if (!editLineId || !canManagePayroll) return;
    try {
      await post({
        action: "update_line",
        lineId: editLineId,
        baseSalary: Number(lineBase || 0),
        commission: Number(lineCommission || 0),
        targetBonus: Number(lineBonus || 0),
        deduction: Number(lineDeduction || 0),
      });
      setOk("Slip diubah.");
      setEditLineId(null);
      setTab("slip");
    } catch {
      /* shown */
    }
  }

  async function removeLine(lineId: string, name: string) {
    if (!canManagePayroll) return;
    if (!window.confirm(`Hapus slip ${name}?`)) return;
    try {
      await post({ action: "delete_line", lineId });
      if (editLineId === lineId) setEditLineId(null);
      setOk(`Slip ${name} dihapus.`);
    } catch {
      /* shown */
    }
  }

  async function removeRun(run: PayrollRun) {
    if (!canManagePayroll) return;
    if (!window.confirm(`Hapus semua slip periode ${run.periodYm}?`)) return;
    try {
      await post({ action: "delete_run", runId: run.id }, "");
      setOk(`Periode ${run.periodYm} dihapus.`);
      setEditLineId(null);
    } catch {
      /* shown */
    }
  }

  const activeCount = employees.filter((e) => e.status === "active").length;
  const incompleteCount = employees.filter((e) => e.status === "active" && (!e.joinedAt || !e.baseSalary)).length;
  const draftEditable = Boolean(canManagePayroll && openRun && openRun.status === "draft");

  if (editing && canEdit) {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <button
          type="button"
          onClick={() => setEditId(null)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#6B6B6B]"
        >
          <ChevronLeft size={16} /> Kembali ke daftar
        </button>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>
            Data gaji
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#111]">{editing.nama}</h1>
          <p className="mt-1 text-sm text-[#6B6B6B]">
            {editing.role}
            {canManagePayroll
              ? " · isi tanggal masuk, gaji pokok, dan tanggal gajian"
              : " · leader bisa isi rekening & catatan; gaji pokok hanya founder"}
          </p>
        </div>
        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
        <div className="space-y-4 border-t border-[#E8E8E4] pt-4">
          <Field label="Tanggal masuk kerja">
            <input
              type="date"
              className="w-full border-0 border-b border-[#E8E8E4] bg-transparent py-2 text-base text-[#111] outline-none focus:border-[#C5A358]"
              value={joinedAt}
              onChange={(e) => setJoinedAt(e.target.value)}
            />
          </Field>
          <Field label="Tanggal gajian tiap bulan (1–28)">
            <input
              type="number"
              min={1}
              max={28}
              disabled={!canManagePayroll}
              className="w-full border-0 border-b border-[#E8E8E4] bg-transparent py-2 text-base text-[#111] outline-none focus:border-[#C5A358] disabled:opacity-50"
              value={payDay}
              onChange={(e) => setPayDay(e.target.value)}
            />
          </Field>
          <Field label="Gaji pokok per bulan">
            <MoneyInput value={baseSalary} onChange={setBaseSalary} disabled={!canManagePayroll} />
          </Field>
          <Field label="No. rekening / catatan transfer">
            <input
              className="w-full border-0 border-b border-[#E8E8E4] bg-transparent py-2 text-base text-[#111] outline-none focus:border-[#C5A358]"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="Opsional"
            />
          </Field>
          <Field label="Catatan kerja">
            <input
              className="w-full border-0 border-b border-[#E8E8E4] bg-transparent py-2 text-base text-[#111] outline-none focus:border-[#C5A358]"
              value={employmentNote}
              onChange={(e) => setEmploymentNote(e.target.value)}
              placeholder="Contoh: masa evaluasi, kontrak, dll."
            />
          </Field>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveEmployee()}
          className="w-full rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-40"
          style={{ background: GOLD }}
        >
          {busy ? "Menyimpan…" : "Simpan data gaji"}
        </button>
      </div>
    );
  }

  if (editingLine && canManagePayroll) {
    const preview =
      Number(lineBase || 0) + Number(lineCommission || 0) + Number(lineBonus || 0) - Number(lineDeduction || 0);
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <button
          type="button"
          onClick={() => setEditLineId(null)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#6B6B6B]"
        >
          <ChevronLeft size={16} /> Kembali ke slip
        </button>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>
            Edit slip
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#111]">{editingLine.salesName}</h1>
          <p className="mt-1 text-sm text-[#6B6B6B]">Ubah nominal slip ini saja. Total dihitung otomatis.</p>
        </div>
        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
        <div className="space-y-4 border-t border-[#E8E8E4] pt-4">
          <Field label="Gaji pokok">
            <MoneyInput value={lineBase} onChange={setLineBase} />
          </Field>
          <Field label="Komisi">
            <MoneyInput value={lineCommission} onChange={setLineCommission} />
          </Field>
          <Field label="Bonus target">
            <MoneyInput value={lineBonus} onChange={setLineBonus} />
          </Field>
          <Field label="Potongan">
            <MoneyInput value={lineDeduction} onChange={setLineDeduction} />
          </Field>
          <div className="flex items-end justify-between border-t border-[#E8E8E4] pt-3">
            <span className="text-xs font-semibold text-[#6B6B6B]">Total</span>
            <span className="text-xl font-bold tabular-nums" style={{ color: GOLD }}>
              {rp(Math.max(0, preview))}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveLine()}
            className="w-full rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-40"
            style={{ background: GOLD }}
          >
            {busy ? "Menyimpan…" : "Simpan slip"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void removeLine(editingLine.id, editingLine.salesName)}
            className="w-full rounded-xl border border-rose-200 py-3 text-sm font-bold text-rose-700 disabled:opacity-40"
          >
            Hapus slip ini
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-[#111] md:text-[28px]">HR & Gaji</h1>
        <p className="mt-1 text-sm text-[#6B6B6B]">
          {ownerName} · {activeCount} sales aktif
          {incompleteCount ? ` · ${incompleteCount} belum lengkap data gaji` : ""}
        </p>
      </div>

      <div className="flex gap-1 border-b border-[#E8E8E4]">
        {(
          [
            { id: "karyawan" as const, label: "Karyawan" },
            { id: "bonus" as const, label: "Bonus" },
            { id: "slip" as const, label: "Slip gaji" },
          ] as const
        ).map((item) => {
          const on = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setError("");
                setOk("");
              }}
              className={`relative px-4 py-2.5 text-sm font-semibold transition ${
                on ? "text-[#111]" : "text-[#8A8A8A] hover:text-[#111]"
              }`}
            >
              {item.label}
              {on ? (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full" style={{ background: GOLD }} />
              ) : null}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {ok ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</p>
      ) : null}

      {tab === "karyawan" ? (
        <section className="space-y-2">
          <p className="text-xs text-[#6B6B6B]">Ketuk orang untuk isi tanggal masuk & gaji. Satu form, satu orang.</p>
          <ul className="divide-y divide-[#EFEFEA] rounded-2xl border border-[#E8E8E4] bg-white">
            {employees.map((emp) => {
              const incomplete = !emp.joinedAt || !emp.baseSalary;
              return (
                <li key={emp.id}>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => canEdit && openEdit(emp)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[#FAFAF8] disabled:cursor-default"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: incomplete ? "#B8B8B0" : GOLD }}
                    >
                      {initials(emp.nama)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#111]">{emp.nama}</span>
                      <span className="mt-0.5 block text-xs text-[#6B6B6B]">
                        {incomplete
                          ? "Belum lengkap — isi gaji dulu"
                          : `Masuk ${emp.joinedAt} · ${rp(emp.baseSalary)} · gajian tgl ${emp.payDay}`}
                      </span>
                    </span>
                    {canEdit ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: GOLD }}>
                        <Pencil size={12} /> Ubah
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {!employees.length ? (
              <li className="px-4 py-8 text-center text-sm text-[#6B6B6B]">Belum ada sales. Tambah di Pengaturan.</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {tab === "bonus" ? (
        <section className="mx-auto max-w-lg space-y-5">
          <div>
            <h2 className="text-base font-bold text-[#111]">Aturan bonus target</h2>
            <p className="mt-1 text-sm text-[#6B6B6B]">
              Capai target → dapat bonus. Bisa ubah atau hapus tiap aturan.
            </p>
          </div>

          <ul className="space-y-2">
            {bonusRules.map((r) => (
              <li key={r.id} className="rounded-xl border border-[#E8E8E4] bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#111]">{r.name}</p>
                    <p className="mt-0.5 text-xs text-[#6B6B6B]">
                      Capai ≥{r.minAchievementPct}% → dapat {rp(r.bonusAmount)}
                      {!r.active ? " · nonaktif" : ""}
                    </p>
                  </div>
                  {canManagePayroll ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => openBonusEdit(r)}
                        className="inline-flex items-center gap-1 text-xs font-bold"
                        style={{ color: GOLD }}
                      >
                        <Pencil size={12} /> Ubah
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeBonus(r.id, r.name)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 disabled:opacity-40"
                      >
                        <Trash2 size={12} /> Hapus
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
            {!bonusRules.length ? (
              <p className="text-sm text-[#6B6B6B]">
                {canManagePayroll ? "Belum ada aturan. Isi di bawah." : "Belum ada aturan bonus."}
              </p>
            ) : null}
          </ul>

          {canManagePayroll ? (
            <div className="space-y-4 border-t border-[#E8E8E4] pt-4">
              <p className="text-sm font-bold text-[#111]">
                {bonusEditId ? "Ubah aturan" : "Tambah aturan baru"}
              </p>
              <Field label="Nama aturan">
                <input
                  className="w-full border-0 border-b border-[#E8E8E4] bg-transparent py-2 text-base outline-none focus:border-[#C5A358]"
                  value={bonusName}
                  onChange={(e) => setBonusName(e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Min. target %">
                  <input
                    type="number"
                    className="w-full border-0 border-b border-[#E8E8E4] bg-transparent py-2 text-base outline-none focus:border-[#C5A358]"
                    value={bonusMin}
                    onChange={(e) => setBonusMin(e.target.value)}
                  />
                </Field>
                <Field label="Nominal bonus">
                  <MoneyInput value={bonusAmount} onChange={setBonusAmount} />
                </Field>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveBonus()}
                  className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: GOLD }}
                >
                  {bonusEditId ? "Simpan perubahan" : "Tambah aturan"}
                </button>
                {bonusEditId ? (
                  <button
                    type="button"
                    onClick={resetBonusForm}
                    className="rounded-xl border border-[#E8E8E4] px-4 py-3 text-sm font-bold text-[#6B6B6B]"
                  >
                    Batal
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "slip" ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[#E8E8E4] bg-[#FAFAF8] px-4 py-3">
            <label className="text-xs font-semibold text-[#6B6B6B]">
              Periode
              <input
                type="month"
                className="mt-1 block rounded-lg border border-[#E8E8E4] bg-white px-3 py-2 text-sm text-[#111]"
                value={periodYm}
                onChange={(e) => setPeriodYm(e.target.value)}
              />
            </label>
            {canManagePayroll ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void generate()}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                style={{ background: GOLD }}
              >
                {busy ? "Menyusun…" : "Buat slip bulan ini"}
              </button>
            ) : (
              <p className="pb-1 text-xs text-[#8A8A8A]">Hanya founder yang menyusun / mengubah slip.</p>
            )}
          </div>

          {incompleteCount && canManagePayroll ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {incompleteCount} sales belum lengkap (tanggal masuk / gaji pokok). Isi di tab Karyawan dulu biar
              slip tidak Rp 0.
            </p>
          ) : null}

          {payrollRuns.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {payrollRuns.map((run) => {
                const on = openRun?.id === run.id;
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setOpenRunId(run.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      on ? "text-white" : "border border-[#E8E8E4] bg-white text-[#6B6B6B]"
                    }`}
                    style={on ? { background: GOLD } : undefined}
                  >
                    {run.periodYm}
                  </button>
                );
              })}
            </div>
          ) : null}

          {!openRun ? (
            <p className="rounded-2xl border border-dashed border-[#E8E8E4] px-4 py-10 text-center text-sm text-[#6B6B6B]">
              Belum ada slip. Pilih periode lalu tekan <strong>Buat slip bulan ini</strong>.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#111]">
                    Periode {openRun.periodYm} · bayar {openRun.payDate}
                  </p>
                  <p className="text-xs text-[#6B6B6B]">
                    {statusLabel(openRun.status)} · total semua {rp(openRun.totals.total)} · {openRun.lines.length}{" "}
                    bill terpisah
                  </p>
                </div>
                {draftEditable ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void markPaid(openRun.id)}
                      className="rounded-xl border border-[#E8E8E4] bg-white px-3 py-2 text-xs font-bold text-[#111]"
                    >
                      Tandai semua sudah dibayar
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeRun(openRun)}
                      className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700"
                    >
                      Hapus periode
                    </button>
                  </div>
                ) : null}
              </div>

              {!openRun.lines.length ? (
                <p className="rounded-2xl border border-dashed border-[#E8E8E4] px-4 py-8 text-center text-sm text-[#6B6B6B]">
                  Tidak ada slip di periode ini.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {openRun.lines.map((line) => (
                    <article
                      key={line.id}
                      className="flex flex-col rounded-2xl border border-[#E8E8E4] bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A8A8A]">
                            Slip gaji
                          </p>
                          <h3 className="mt-1 text-base font-bold text-[#111]">{line.salesName}</h3>
                        </div>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            openRun.status === "paid"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-[#F7F4EC] text-[#8A7040]"
                          }`}
                        >
                          {statusLabel(openRun.status)}
                        </span>
                      </div>

                      <dl className="mt-4 flex-1 space-y-2 border-t border-[#F0F0EC] pt-3 text-sm">
                        <Row label="Gaji pokok" value={rp(line.baseSalary)} />
                        <Row label="Komisi" value={rp(line.commission)} />
                        <Row label="Bonus target" value={rp(line.targetBonus)} />
                        {line.deduction > 0 ? (
                          <Row label="Potongan" value={`−${rp(line.deduction)}`} />
                        ) : null}
                        <Row label="Pencapaian target" value={`${Math.round(line.achievementPct)}%`} />
                        <Row label="Gajian tgl" value={String(line.payDay || 25)} />
                        {line.bankAccount ? <Row label="Rekening" value={line.bankAccount} /> : null}
                      </dl>

                      {line.note ? (
                        <p className="mt-3 text-[11px] leading-snug text-[#8A8A8A]">{line.note}</p>
                      ) : null}

                      <div className="mt-4 flex items-end justify-between border-t border-[#E8E8E4] pt-3">
                        <span className="text-xs font-semibold text-[#6B6B6B]">Total dibayar</span>
                        <span className="text-lg font-bold tabular-nums" style={{ color: GOLD }}>
                          {rp(line.total)}
                        </span>
                      </div>

                      {draftEditable ? (
                        <div className="mt-3 flex gap-2 border-t border-[#F0F0EC] pt-3">
                          <button
                            type="button"
                            onClick={() => openLineEdit(line)}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-[#E8E8E4] py-2 text-xs font-bold text-[#111]"
                          >
                            <Pencil size={12} /> Ubah
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeLine(line.id, line.salesName)}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-rose-200 py-2 text-xs font-bold text-rose-700 disabled:opacity-40"
                          >
                            <Trash2 size={12} /> Hapus
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#6B6B6B]">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function MoneyInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline gap-2 border-b border-[#E8E8E4] focus-within:border-[#C5A358] ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <span className="text-sm text-[#8A8A8A]">Rp</span>
      <input
        type="number"
        min={0}
        disabled={disabled}
        className="w-full border-0 bg-transparent py-2 text-base tabular-nums text-[#111] outline-none disabled:cursor-not-allowed"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[#6B6B6B]">{label}</dt>
      <dd className="font-semibold tabular-nums text-[#111]">{value}</dd>
    </div>
  );
}
