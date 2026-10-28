"use client";

import { X } from "lucide-react";
import OfficeWorkPanel from "./office-work-panel";
import { placeLine, STATUS_LABEL, statusMeaning, taskLine } from "@/lib/office/present";
import type { AgentStatus, OfficeAgent, OfficeSnapshot, OfficeViewMode } from "@/lib/office/types";

const STATUS_CLASS: Record<AgentStatus, string> = {
  working: "bg-emerald-500/15 text-emerald-300",
  idle: "bg-sky-500/15 text-sky-300",
  error: "bg-amber-500/15 text-amber-300",
};

export default function OfficeHud({
  snapshot,
  businessName,
  selected,
  mode,
  webgl,
  weak,
  onSelect,
  onMode,
  onReset,
  onSnapshot,
}: {
  snapshot: OfficeSnapshot;
  businessName: string;
  selected: OfficeAgent | null;
  mode: OfficeViewMode;
  webgl: boolean;
  weak: boolean;
  onSelect: (id: string | null) => void;
  onMode: (mode: OfficeViewMode) => void;
  onReset: () => void;
  onSnapshot: (snapshot: OfficeSnapshot) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-auto absolute top-3 left-3 flex max-h-[calc(100%-1.5rem)] w-[min(calc(100%-5.5rem),340px)] flex-col gap-3 overflow-y-auto">
        <section className="dashboard-card p-4 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Kantor AI</p>
          <h1 className="text-lg font-semibold text-white">{businessName}</h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Data bisnis ini, hari ini. Klik nama untuk mendekat, lalu tanya atau suruh.
          </p>
          {snapshot.notices.length ? (
            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-amber-200/90">
              {snapshot.notices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/[0.06] bg-[#0b0e14] p-3">
              <p className="text-[11px] text-slate-500">Sedang kerja</p>
              <p className="mt-1 text-xl font-bold text-white">
                {snapshot.crew_active}
                <span className="text-sm font-medium text-slate-500"> dari {snapshot.crew_total}</span>
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-[#0b0e14] p-3">
              <p className="text-[11px] text-slate-500">Tugas berjalan</p>
              <p className="mt-1 text-xl font-bold text-white">{snapshot.tasks_running}</p>
            </div>
          </div>
        </section>

        <section className="dashboard-card space-y-2 p-3 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
          {snapshot.agents.map((agent) => {
            const active = selected?.id === agent.id;
            return (
              <button
                key={agent.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : agent.id)}
                className={[
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  active ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/10" : "border-white/[0.06] bg-[#0b0e14] hover:border-white/15",
                ].join(" ")}
              >
                <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: agent.color }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-white">{agent.name}</span>
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[agent.status]}`}>
                      {STATUS_LABEL[agent.status]}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-300">{placeLine(agent)}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{taskLine(agent)}</span>
                </span>
              </button>
            );
          })}
        </section>

        {selected ? (
          <section className="dashboard-card p-4 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Yang sedang dilihat</p>
                <h2 className="text-base font-semibold text-white">{selected.name}</h2>
              </div>
              <button
                type="button"
                aria-label="Tutup detail"
                onClick={() => onSelect(null)}
                className="rounded-lg border border-white/[0.08] p-1.5 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">{placeLine(selected)}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{taskLine(selected)}</p>
            <p className="mt-2 rounded-xl bg-[#0b0e14] px-3 py-2 text-xs leading-relaxed text-slate-400">
              {statusMeaning(selected)}
            </p>
            <div className="mt-3">
              <OfficeWorkPanel key={selected.id} agent={selected} snapshot={snapshot} onSnapshot={onSnapshot} />
            </div>
          </section>
        ) : (
          <p className="px-1 text-[11px] leading-relaxed text-slate-500">
            Belum ada yang dipilih. Klik nama di atas, atau klik orang di dalam kantor.
          </p>
        )}
      </div>

      <div className="pointer-events-auto absolute top-3 right-3 flex flex-col items-end gap-2">
        <div className="flex rounded-xl border border-white/[0.07] bg-[#151921] p-1 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
          {(["3d", "2d"] as const).map((value) => {
            const disabled = value === "3d" && !webgl;
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                title={disabled ? "Perangkat ini tidak mendukung 3D" : value === "2d" ? "Lihat dari atas" : "Lihat miring"}
                onClick={() => onMode(value)}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  active ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200",
                  disabled ? "cursor-not-allowed opacity-40" : "",
                ].join(" ")}
              >
                {value.toUpperCase()}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onReset} className="dash-header-btn shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
          Lihat semua ruang
        </button>
        {weak ? <p className="max-w-40 text-right text-[10px] leading-snug text-slate-500">Perangkat ringan: mulai dari tampilan atas.</p> : null}
        {!webgl ? <p className="max-w-40 text-right text-[10px] leading-snug text-slate-500">WebGL tidak tersedia. Denah 2D.</p> : null}
      </div>
    </div>
  );
}
