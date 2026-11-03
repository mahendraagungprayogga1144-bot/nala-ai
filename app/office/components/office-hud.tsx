"use client";

import { useState } from "react";
import { X } from "lucide-react";
import OfficeWorkPanel from "./office-work-panel";
import { DIVISION_LABEL, placeLine, STATUS_LABEL, statusMeaning, taskLine } from "@/lib/office/present";
import type { AgentStatus, OfficeAgent, OfficeDivision, OfficeSnapshot, OfficeViewMode } from "@/lib/office/types";

const DIVISIONS: { id: "semua" | OfficeDivision; label: string }[] = [
  { id: "semua", label: "Ringkasan" },
  { id: "kantor", label: "Kantor" },
  { id: "software", label: "Software" },
  { id: "sosmed", label: "Sosmed" },
  { id: "marketing", label: "Marketing" },
];

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
  const [division, setDivision] = useState<(typeof DIVISIONS)[number]["id"]>("semua");
  const visible = division === "semua" ? snapshot.agents : snapshot.agents.filter((agent) => agent.division === division);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
      <div className="pointer-events-auto m-2 flex max-h-[min(42vh,22rem)] flex-col gap-2 overflow-hidden sm:m-3 md:max-h-none md:flex-row md:items-start md:gap-3">
        <section className="dashboard-card min-h-0 min-w-0 flex-1 overflow-y-auto p-3 shadow-[0_16px_48px_rgba(0,0,0,0.28)]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Kantor AI</p>
              <h1 className="truncate text-base font-semibold text-white">{businessName}</h1>
            </div>
            <p className="text-[11px] text-slate-400">
              Kerja {snapshot.crew_active}/{snapshot.crew_total}
              <span className="mx-1.5 text-slate-600">·</span>
              Tugas {snapshot.tasks_running}
            </p>
          </div>
          {snapshot.notices.length ? (
            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-amber-200/90">
              {snapshot.notices.slice(0, 2).map((notice) => (
                <li key={notice} className="line-clamp-2">
                  {notice}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {DIVISIONS.map((item) => {
              const active = division === item.id;
              const count = item.id === "semua" ? snapshot.agents.length : snapshot.agents.filter((agent) => agent.division === item.id).length;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDivision(item.id)}
                  className={[
                    "shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                    active ? "bg-white text-[#0b0e14]" : "bg-[#0b0e14] text-slate-300",
                  ].join(" ")}
                >
                  {item.label} {count}
                </button>
              );
            })}
          </div>
          {!selected ? (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {visible.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => onSelect(agent.id)}
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0b0e14] px-2.5 py-2 text-left hover:border-white/15"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: agent.color }} />
                  <span className="max-w-[7.5rem] truncate text-sm font-semibold text-white">{agent.name}</span>
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[agent.status]}`}>
                    {STATUS_LABEL[agent.status]}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
            <div className="flex rounded-xl border border-white/[0.07] bg-[#151921] p-1">
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
            <button type="button" onClick={onReset} className="dash-header-btn">
              Semua ruang
            </button>
          </div>
        </section>
        <div className="hidden shrink-0 flex-col items-end gap-2 md:flex">
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

      <div className="min-h-0 flex-1" />

      {selected ? (
        <section className="pointer-events-auto dashboard-card mx-2 mb-[max(0.5rem,env(safe-area-inset-bottom,0px))] grid max-h-[min(48vh,28rem)] gap-3 overflow-y-auto p-3 shadow-[0_16px_48px_rgba(0,0,0,0.28)] sm:mx-3 sm:mb-3 sm:gap-4 sm:p-4 md:grid-cols-[220px_minmax(0,1fr)] md:max-h-[46vh]">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Yang sedang dilihat</p>
                <h2 className="truncate text-base font-semibold text-white">{selected.name}</h2>
              </div>
              <button
                type="button"
                aria-label="Tutup detail"
                onClick={() => onSelect(null)}
                className="shrink-0 rounded-lg border border-white/[0.08] p-1.5 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">{placeLine(selected)}</p>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-400">{taskLine(selected)}</p>
            <p className="mt-2 hidden rounded-xl bg-[#0b0e14] px-3 py-2 text-xs leading-relaxed text-slate-400 md:block">{statusMeaning(selected)}</p>
          </div>
          <OfficeWorkPanel key={selected.id} agent={selected} snapshot={snapshot} onSnapshot={onSnapshot} />
        </section>
      ) : (
        <section className="pointer-events-auto dashboard-card mx-2 mb-[max(0.5rem,env(safe-area-inset-bottom,0px))] max-h-[min(32vh,16rem)] overflow-y-auto p-3 shadow-[0_16px_48px_rgba(0,0,0,0.28)] sm:mx-3 sm:mb-3 md:max-h-[34vh]">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Agen {visible.length}</p>
          <ul className="mt-2 space-y-1.5">
            {visible.map((agent) => (
              <li key={agent.id}>
                <button type="button" onClick={() => onSelect(agent.id)} className="w-full rounded-xl bg-[#0b0e14] px-3 py-2 text-left hover:bg-white/[0.04]">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: agent.color }} />
                    <span className="min-w-0 truncate text-xs font-semibold text-white">{agent.name}</span>
                    <span className="shrink-0 text-[10px] text-slate-500">{DIVISION_LABEL[agent.division]}</span>
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-slate-300">{taskLine(agent)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
