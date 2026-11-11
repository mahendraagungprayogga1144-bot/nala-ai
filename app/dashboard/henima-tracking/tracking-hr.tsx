"use client";

import { useState } from "react";
import { CalendarDays, Gift, Users, Wallet } from "lucide-react";

const GOLD = "#C5A358";

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

type PayrollRun = {
  id: string;
  periodYm: string;
  payDate: string;
  status: "draft" | "paid" | "void";
  lines: {
    id: string;
    salesName: string;
    baseSalary: number;
    commission: number;
    targetBonus: number;
    deduction: number;
    total: number;
    achievementPct: number;
  }[];
  totals: { base: number; commission: number; bonus: number; deduction: number; total: number };
};

function rp(n: number) {
  return `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
}

export default function TrackingHr({
  ownerName,
  canEdit,
  employees: initialEmployees,
  bonusRules: initialRules,
  payrollRuns: initialRuns,
  defaultPeriod,
}: {
  ownerName: string;
  canEdit: boolean;
  employees: Employee[];
  bonusRules: BonusRule[];
  payrollRuns: PayrollRun[];
  defaultPeriod: string;
}) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [bonusRules, setBonusRules] = useState(initialRules);
  const [payrollRuns, setPayrollRuns] = useState(initialRuns);
  const [periodYm, setPeriodYm] = useState(defaultPeriod);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [editId, setEditId] = useState("");
  const editing = employees.find((e) => e.id === editId);
  const [joinedAt, setJoinedAt] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [payDay, setPayDay] = useState("25");
  const [bankAccount, setBankAccount] = useState("");

  const [bonusName, setBonusName] = useState("Bonus target 100%");
  const [bonusAmount, setBonusAmount] = useState("500000");
  const [bonusMin, setBonusMin] = useState("100");

  function openEdit(emp: Employee) {
    setEditId(emp.id);
    setJoinedAt(emp.joinedAt || "");
    setBaseSalary(String(emp.baseSalary || ""));
    setPayDay(String(emp.payDay || 25));
    setBankAccount(emp.bankAccount || "");
    setError("");
    setOk("");
  }

  async function post(body: Record<string, unknown>) {
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
      if (json.payrollRuns) setPayrollRuns(json.payrollRuns);
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
      await post({
        action: "update_employee",
        staffId: editId,
        joinedAt: joinedAt || null,
        baseSalary: Number(baseSalary || 0),
        payDay: Number(payDay || 25),
        bankAccount: bankAccount || null,
      });
      setOk("Data HR sales disimpan.");
      setEditId("");
    } catch {
      /* shown */
    }
  }

  async function saveBonus() {
    try {
      await post({
        action: "upsert_bonus",
        name: bonusName,
        kind: "target_pct",
        minAchievementPct: Number(bonusMin || 100),
        bonusAmount: Number(bonusAmount || 0),
        active: true,
      });
      setOk("Aturan bonus disimpan.");
    } catch {
      /* shown */
    }
  }

  async function generate() {
    try {
      await post({ action: "generate_payroll", periodYm });
      setOk(`Slip gaji ${periodYm} disusun (draft).`);
    } catch {
      /* shown */
    }
  }

  async function markPaid(runId: string) {
    try {
      await post({ action: "mark_paid", runId });
      setOk("Penggajian ditandai sudah dibayar.");
    } catch {
      /* shown */
    }
  }

  const latest = payrollRuns[0];
  const activeCount = employees.filter((e) => e.status === "active").length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#111] md:text-[30px]">
            Selamat datang, {ownerName}
          </h1>
          <p className="mt-1 text-sm text-[#6B6B6B]">
            HR sales: tanggal masuk, gaji pokok, jadwal gajian, komisi & bonus target.
          </p>
        </div>
        <aside className="rounded-2xl border border-[#E8D9A8] bg-[#F7F4EC] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>
            HENIMA HR
          </p>
          <p className="mt-1 text-sm font-bold text-[#111]">{activeCount} sales aktif</p>
          <p className="mt-0.5 text-xs text-[#6B6B6B]">Gajian tiap tanggal {employees[0]?.payDay || 25}</p>
        </aside>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={Users} label="Karyawan sales" value={`${activeCount}`} hint="Status aktif" />
        <Stat
          icon={Wallet}
          label="Total gaji pokok"
          value={rp(employees.filter((e) => e.status === "active").reduce((s, e) => s + e.baseSalary, 0))}
          hint="Per bulan"
        />
        <Stat
          icon={Gift}
          label="Aturan bonus"
          value={`${bonusRules.filter((r) => r.active).length}`}
          hint="Aktif"
        />
        <Stat
          icon={CalendarDays}
          label="Slip terakhir"
          value={latest ? latest.periodYm : "—"}
          hint={latest ? latest.status : "Belum disusun"}
        />
      </div>

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {ok ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</p> : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-[0_8px_24px_rgba(17,17,17,0.04)] xl:col-span-2">
          <h2 className="text-sm font-bold text-[#111]">Data karyawan sales</h2>
          <p className="mt-1 text-xs text-[#6B6B6B]">Tanggal masuk · gaji pokok · tanggal gajian</p>
          <ul className="mt-4 space-y-2">
            {employees.map((emp) => (
              <li
                key={emp.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#111]">
                    {emp.nama}{" "}
                    <span className="text-xs font-semibold text-[#8A8A8A]">· {emp.role}</span>
                  </p>
                  <p className="text-xs text-[#6B6B6B]">
                    Masuk {emp.joinedAt || "belum diisi"} · Gaji {rp(emp.baseSalary)} · Gajian tgl {emp.payDay}
                  </p>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => openEdit(emp)}
                    className="rounded-xl border border-[#E8E8E4] px-3 py-1.5 text-xs font-bold text-[#111]"
                  >
                    Edit HR
                  </button>
                ) : null}
              </li>
            ))}
            {!employees.length && <p className="text-sm text-[#6B6B6B]">Belum ada sales. Tambah di Pengaturan.</p>}
          </ul>

          {editing && canEdit ? (
            <div className="mt-4 rounded-xl border border-[#E8D9A8] bg-[#F7F4EC] p-4">
              <p className="text-sm font-bold text-[#111]">Edit · {editing.nama}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-semibold text-[#6B6B6B]">
                  Tanggal masuk
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border border-[#E8E8E4] bg-white px-3 py-2 text-sm"
                    value={joinedAt}
                    onChange={(e) => setJoinedAt(e.target.value)}
                  />
                </label>
                <label className="text-xs font-semibold text-[#6B6B6B]">
                  Tanggal gajian (1–28)
                  <input
                    type="number"
                    min={1}
                    max={28}
                    className="mt-1 w-full rounded-xl border border-[#E8E8E4] bg-white px-3 py-2 text-sm"
                    value={payDay}
                    onChange={(e) => setPayDay(e.target.value)}
                  />
                </label>
                <label className="text-xs font-semibold text-[#6B6B6B]">
                  Gaji pokok (Rp)
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-xl border border-[#E8E8E4] bg-white px-3 py-2 text-sm"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                  />
                </label>
                <label className="text-xs font-semibold text-[#6B6B6B]">
                  Rekening
                  <input
                    className="mt-1 w-full rounded-xl border border-[#E8E8E4] bg-white px-3 py-2 text-sm"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="Opsional"
                  />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveEmployee()}
                  className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: GOLD }}
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setEditId("")}
                  className="rounded-xl border border-[#E8E8E4] px-4 py-2 text-sm font-bold"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-[0_8px_24px_rgba(17,17,17,0.04)]">
            <h2 className="text-sm font-bold text-[#111]">Aturan bonus</h2>
            <p className="mt-1 text-xs text-[#6B6B6B]">Bonus jika target periode tercapai (mis. 100%).</p>
            <ul className="mt-3 space-y-2">
              {bonusRules.map((r) => (
                <li key={r.id} className="rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-2 text-sm">
                  <p className="font-bold text-[#111]">{r.name}</p>
                  <p className="text-xs text-[#6B6B6B]">
                    ≥{r.minAchievementPct}% → {rp(r.bonusAmount)} {r.active ? "" : "(nonaktif)"}
                  </p>
                </li>
              ))}
              {!bonusRules.length && <p className="text-sm text-[#6B6B6B]">Belum ada aturan bonus.</p>}
            </ul>
            {canEdit ? (
              <div className="mt-3 space-y-2 border-t border-[#E8E8E4] pt-3">
                <input
                  className="w-full rounded-xl border border-[#E8E8E4] px-3 py-2 text-sm"
                  value={bonusName}
                  onChange={(e) => setBonusName(e.target.value)}
                  placeholder="Nama aturan"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded-xl border border-[#E8E8E4] px-3 py-2 text-sm"
                    type="number"
                    value={bonusMin}
                    onChange={(e) => setBonusMin(e.target.value)}
                    placeholder="Min %"
                  />
                  <input
                    className="rounded-xl border border-[#E8E8E4] px-3 py-2 text-sm"
                    type="number"
                    value={bonusAmount}
                    onChange={(e) => setBonusAmount(e.target.value)}
                    placeholder="Bonus Rp"
                  />
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveBonus()}
                  className="w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: GOLD }}
                >
                  Simpan aturan bonus
                </button>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-[0_8px_24px_rgba(17,17,17,0.04)]">
            <h2 className="text-sm font-bold text-[#111]">Susun penggajian</h2>
            <p className="mt-1 text-xs text-[#6B6B6B]">Gaji pokok + komisi lunas + bonus target</p>
            <label className="mt-3 block text-xs font-semibold text-[#6B6B6B]">
              Periode (YYYY-MM)
              <input
                className="mt-1 w-full rounded-xl border border-[#E8E8E4] px-3 py-2 text-sm"
                value={periodYm}
                onChange={(e) => setPeriodYm(e.target.value)}
              />
            </label>
            {canEdit ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void generate()}
                className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-40"
                style={{ background: GOLD }}
              >
                {busy ? "Menyusun…" : "Susun slip gaji"}
              </button>
            ) : null}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-[0_8px_24px_rgba(17,17,17,0.04)]">
        <h2 className="text-sm font-bold text-[#111]">Slip penggajian</h2>
        {!payrollRuns.length && <p className="mt-3 text-sm text-[#6B6B6B]">Belum ada slip. Susun periode dulu.</p>}
        <div className="mt-3 space-y-4">
          {payrollRuns.map((run) => (
            <div key={run.id} className="rounded-xl border border-[#E8E8E4] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-[#111]">
                    {run.periodYm} · bayar {run.payDate}
                  </p>
                  <p className="text-xs text-[#6B6B6B]">
                    Status {run.status} · Total {rp(run.totals.total)}
                  </p>
                </div>
                {canEdit && run.status === "draft" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void markPaid(run.id)}
                    className="rounded-xl border border-[#E8E8E4] px-3 py-1.5 text-xs font-bold"
                  >
                    Tandai dibayar
                  </button>
                ) : null}
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="text-[#8A8A8A]">
                    <tr>
                      <th className="py-1 font-semibold">Sales</th>
                      <th className="py-1 font-semibold">Pokok</th>
                      <th className="py-1 font-semibold">Komisi</th>
                      <th className="py-1 font-semibold">Bonus</th>
                      <th className="py-1 font-semibold">Target %</th>
                      <th className="py-1 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.lines.map((l) => (
                      <tr key={l.id} className="border-t border-[#F0F0EC]">
                        <td className="py-1.5 font-semibold text-[#111]">{l.salesName}</td>
                        <td className="py-1.5">{rp(l.baseSalary)}</td>
                        <td className="py-1.5">{rp(l.commission)}</td>
                        <td className="py-1.5">{rp(l.targetBonus)}</td>
                        <td className="py-1.5">{Math.round(l.achievementPct)}%</td>
                        <td className="py-1.5 font-bold" style={{ color: GOLD }}>
                          {rp(l.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-[0_8px_24px_rgba(17,17,17,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8A8A]">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F7F4EC]">
          <Icon size={15} color={GOLD} />
        </span>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums text-[#111]">{value}</p>
      <p className="mt-1 text-xs text-[#6B6B6B]">{hint}</p>
    </div>
  );
}
