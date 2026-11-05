"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PhaseBanner from "../components/phase-banner";
import SectionCard from "../components/section-card";
import { MASTER_MENTOR_BASE } from "@/lib/master-mentor/types";

type View = "assistant" | "planner" | "monitor" | "permissions" | "tools";

type Task = {
  id: string;
  goal: string;
  status: string;
  permission_level: number;
  risk_level: string;
  created_at: string;
  error_log?: string;
  result?: Record<string, unknown> | null;
};

export default function AutonomyDesk({
  view,
  title,
  subtitle,
  businesses,
}: {
  view: View;
  title: string;
  subtitle: string;
  businesses: { id: string; name: string }[];
}) {
  const [goal, setGoal] = useState(
    "Analisis penjualan minggu ini dan cari cara meningkatkan keuntungan.",
  );
  const [businessId, setBusinessId] = useState(businesses[0]?.id || "");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<{
    task: Task;
    steps: {
      id: string;
      step_index: number;
      title: string;
      tool_name: string;
      status: string;
      error_log?: string;
      output?: Record<string, unknown> | null;
    }[];
  } | null>(null);
  const [monitor, setMonitor] = useState<Record<string, unknown> | null>(null);
  const [settings, setSettings] = useState({
    autonomy_level: 0,
    emergency_stop: false,
    allowed_level3_tools: [] as string[],
    max_concurrent_tasks: 3,
    notes: "",
  });
  const [tools, setTools] = useState<
    { name: string; description: string; permissionLevel: number; risk: string; requiresApproval: boolean }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadTasks = async () => {
    const res = await fetch("/api/master-mentor/autonomy/tasks");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Gagal (${res.status})`);
    setTasks(data.tasks || []);
    if (data.notice) setError(data.notice);
  };

  const loadMonitor = async () => {
    const res = await fetch("/api/master-mentor/autonomy/monitor");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Gagal (${res.status})`);
    setMonitor(data);
  };

  const loadSettings = async () => {
    const res = await fetch("/api/master-mentor/autonomy/settings");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Gagal (${res.status})`);
    if (data.settings) {
      setSettings({
        autonomy_level: Number(data.settings.autonomy_level) || 0,
        emergency_stop: Boolean(data.settings.emergency_stop),
        allowed_level3_tools: data.settings.allowed_level3_tools || [],
        max_concurrent_tasks: Number(data.settings.max_concurrent_tasks) || 3,
        notes: data.settings.notes || "",
      });
    }
  };

  const loadTools = async () => {
    const res = await fetch("/api/master-mentor/autonomy/tools");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Gagal (${res.status})`);
    setTools(data.tools || []);
  };

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      if (view === "monitor") await loadMonitor();
      else if (view === "permissions") await loadSettings();
      else if (view === "tools") await loadTools();
      else await loadTasks();
      if (view === "assistant" || view === "planner") await loadSettings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const createAndRun = async (autoRun: boolean) => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/master-mentor/autonomy/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, business_id: businessId || null, autoRun }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Gagal (${res.status})`);
      setMsg(
        data.run
          ? `Task ${data.run.status}: ${data.run.summary}`
          : data.duplicate
            ? "Task duplikat hari ini (idempotency) — dibuka ulang."
            : "Task dibuat. Klik Jalankan untuk eksekusi.",
      );
      await loadTasks();
      if (data.task?.id) await openTask(data.task.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  };

  const openTask = async (id: string) => {
    const res = await fetch(`/api/master-mentor/autonomy/tasks/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Gagal detail");
    setSelected({ task: data.task, steps: data.steps || [] });
  };

  const taskAction = async (id: string, action: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/master-mentor/autonomy/tasks/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Gagal (${res.status})`);
      setMsg(data.run?.summary || `OK: ${action}`);
      await loadTasks();
      await openTask(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/master-mentor/autonomy/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal simpan");
      setMsg("Permission settings disimpan. Default production tetap hati-hati — mulai dari level 0/1.");
      await loadSettings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  };

  const toggleStop = async (active: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/master-mentor/autonomy/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emergency_stop: active,
          notes: active ? "Owner emergency stop" : "Emergency stop cleared",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal");
      await loadSettings();
      setMsg(active ? "EMERGENCY STOP AKTIF — semua eksekusi autonomous dihentikan." : "Emergency stop dimatikan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  };

  const counts = (monitor?.counts || {}) as Record<string, number>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[#111827]">{title}</h1>
        <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>
      </header>

      <div className="mb-5 space-y-3">
        <PhaseBanner message="Phase 7 Bounded Autonomy: AI hanya memakai tool registry. Level 2 wajib Approval Center. Default level 0. Emergency stop tersedia." />
        {settings.emergency_stop ? (
          <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#991B1B]">
            Emergency stop AKTIF — autonomous execution diblokir.
          </p>
        ) : null}
        {error ? <p className="text-sm text-[#B91C1C]">{error}</p> : null}
        {msg ? <p className="text-sm text-[#065F46]">{msg}</p> : null}
      </div>

      {(view === "assistant" || view === "planner") && (
        <SectionCard title={view === "planner" ? "Task Planner" : "Autonomous Assistant"} subtitle={`Level owner saat ini: ${settings.autonomy_level}`}>
          <div className="space-y-3">
            <label className="block text-xs font-medium text-[#4B5563]">
              Bisnis
              <select
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
              >
                <option value="">— tanpa bisnis —</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-[#4B5563]">
              Perintah / tujuan
              <textarea
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                rows={3}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !goal.trim()}
                onClick={() => createAndRun(false)}
                className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#111827] disabled:opacity-50"
              >
                Susun rencana
              </button>
              <button
                type="button"
                disabled={busy || !goal.trim() || settings.emergency_stop}
                onClick={() => createAndRun(true)}
                className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Rencana + jalankan
              </button>
              <Link href={`${MASTER_MENTOR_BASE}/approvals`} className="rounded-lg px-4 py-2 text-sm text-[#2563EB]">
                Buka Approval Center →
              </Link>
            </div>
          </div>
        </SectionCard>
      )}

      {view === "monitor" && monitor ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          {[
            ["Active", counts.active],
            ["Pending Approval", counts.waiting_approval],
            ["Completed", counts.completed],
            ["Failed", counts.failed],
          ].map(([label, n]) => (
            <div key={String(label)} className="rounded-xl border border-[#E5E7EB] px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-[#111827]">{n ?? 0}</p>
            </div>
          ))}
          <div className="sm:col-span-4 rounded-xl border border-[#E5E7EB] px-4 py-3 text-sm text-[#4B5563]">
            Avg execution:{" "}
            {monitor.avgExecutionMs != null ? `${Math.round(Number(monitor.avgExecutionMs) / 1000)}s` : "—"}
            {" · "}
            Token usage:{" "}
            {monitor.tokenUsage
              ? JSON.stringify(monitor.tokenUsage)
              : "n/a (planner deterministik — belum LLM tokens)"}
          </div>
        </div>
      ) : null}

      {view === "permissions" ? (
        <SectionCard title="Permission Settings" subtitle="Owner-only. Level 3 tidak boleh self-escalate.">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-[#4B5563]">
              Autonomy level (0–3)
              <select
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.autonomy_level}
                onChange={(e) => setSettings({ ...settings, autonomy_level: Number(e.target.value) })}
              >
                <option value={0}>0 — Read Only</option>
                <option value={1}>1 — Prepare</option>
                <option value={2}>2 — Approval Required</option>
                <option value={3}>3 — Limited Autonomy</option>
              </select>
            </label>
            <label className="text-xs font-medium text-[#4B5563]">
              Max concurrent tasks
              <input
                type="number"
                min={1}
                max={20}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.max_concurrent_tasks}
                onChange={(e) =>
                  setSettings({ ...settings, max_concurrent_tasks: Number(e.target.value) || 3 })
                }
              />
            </label>
            <label className="sm:col-span-2 text-xs font-medium text-[#4B5563]">
              Level 3 allowlist (pisah koma)
              <input
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.allowed_level3_tools.join(", ")}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    allowed_level3_tools: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="data.check_scheduled_health, report.run_internal_summary"
              />
            </label>
            <label className="sm:col-span-2 text-xs font-medium text-[#4B5563]">
              Catatan
              <textarea
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                rows={2}
                value={settings.notes}
                onChange={(e) => setSettings({ ...settings, notes: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={saveSettings}
              className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Simpan
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => toggleStop(true)}
              className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-2 text-sm font-medium text-[#991B1B]"
            >
              Emergency Stop
            </button>
            <button
              type="button"
              disabled={busy || !settings.emergency_stop}
              onClick={() => toggleStop(false)}
              className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm"
            >
              Clear Stop
            </button>
          </div>
        </SectionCard>
      ) : null}

      {view === "tools" ? (
        <SectionCard title="Tool Registry" subtitle="Hanya tools ini yang boleh dipanggil AI.">
          <div className="space-y-2">
            {tools.map((t) => (
              <div key={t.name} className="rounded-lg border border-[#E5E7EB] px-3 py-2">
                <p className="text-sm font-semibold text-[#111827]">{t.name}</p>
                <p className="text-xs text-[#6B7280]">{t.description}</p>
                <p className="mt-1 text-[11px] text-[#9CA3AF]">
                  level {t.permissionLevel} · risk {t.risk}
                  {t.requiresApproval ? " · approval wajib" : ""}
                </p>
              </div>
            ))}
            {!tools.length ? <p className="text-sm text-[#6B7280]">Belum ada tools / gagal load.</p> : null}
          </div>
        </SectionCard>
      ) : null}

      {(view === "assistant" || view === "planner" || view === "monitor") && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <SectionCard title="Tasks" subtitle="Riwayat tugas autonomous">
            <div className="max-h-[420px] space-y-2 overflow-y-auto">
              {(view === "monitor"
                ? ((monitor?.recentTasks as Task[]) || tasks)
                : tasks
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTask(t.id).catch((e) => setError(String(e.message || e)))}
                  className="block w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-left hover:bg-[#F9FAFB]"
                >
                  <p className="truncate text-sm font-medium text-[#111827]">{t.goal}</p>
                  <p className="text-[11px] text-[#6B7280]">
                    {t.status} · L{t.permission_level} · {t.risk_level}
                  </p>
                </button>
              ))}
              {!tasks.length ? <p className="text-sm text-[#6B7280]">Belum ada task.</p> : null}
            </div>
          </SectionCard>

          <SectionCard title="Detail" subtitle="Langkah & verifikasi">
            {!selected ? (
              <p className="text-sm text-[#6B7280]">Pilih task untuk melihat langkah.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[#111827]">{selected.task.goal}</p>
                <p className="text-xs text-[#6B7280]">
                  Status: <strong>{selected.task.status}</strong>
                </p>
                {selected.task.error_log ? (
                  <p className="text-xs text-[#B91C1C]">{selected.task.error_log}</p>
                ) : null}
                <ol className="space-y-2">
                  {selected.steps.map((s) => (
                    <li key={s.id} className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs">
                      <p className="font-medium text-[#111827]">
                        {s.step_index + 1}. {s.title}
                      </p>
                      <p className="text-[#6B7280]">
                        {s.tool_name} · {s.status}
                      </p>
                      {s.error_log ? <p className="text-[#B91C1C]">{s.error_log}</p> : null}
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-lg bg-[#111827] px-3 py-1.5 text-xs text-white"
                    onClick={() => taskAction(selected.task.id, "run")}
                  >
                    Jalankan
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs"
                    onClick={() => taskAction(selected.task.id, "continue_after_approval")}
                  >
                    Lanjut setelah approval
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs"
                    onClick={() => taskAction(selected.task.id, "pause")}
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-lg border border-[#FECACA] px-3 py-1.5 text-xs text-[#991B1B]"
                    onClick={() => taskAction(selected.task.id, "cancel")}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
