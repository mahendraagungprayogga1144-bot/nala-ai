"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Building2,
  Code2,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Share2,
  X,
} from "lucide-react";
import OfficeWorkPanel from "./office-work-panel";
import { DIVISION_LABEL, placeLine, STATUS_LABEL, statusMeaning, taskLine } from "@/lib/office/present";
import { createClient } from "@/lib/supabase/client";
import { clearFastGateCookies } from "@/lib/auth/post-login";
import type { AgentStatus, OfficeAgent, OfficeDivision, OfficeSnapshot, OfficeViewMode } from "@/lib/office/types";

const DIVISIONS: { id: "semua" | OfficeDivision; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "semua", label: "Ringkasan", icon: LayoutDashboard },
  { id: "kantor", label: "Kantor", icon: Building2 },
  { id: "software", label: "Software", icon: Code2 },
  { id: "sosmed", label: "Sosmed", icon: Share2 },
  { id: "marketing", label: "Marketing", icon: Megaphone },
];

const STATUS_CLASS: Record<AgentStatus, string> = {
  working: "bg-emerald-100 text-emerald-700",
  idle: "bg-sky-100 text-sky-700",
  error: "bg-amber-100 text-amber-700",
};

async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  clearFastGateCookies();
  window.location.assign("/login");
}

export default function OfficeHud({
  snapshot,
  businessName,
  userName,
  selected,
  mode,
  webgl,
  weak,
  onSelect,
  onMode,
  onReset,
  onSnapshot,
  children,
}: {
  snapshot: OfficeSnapshot;
  businessName: string;
  userName: string;
  selected: OfficeAgent | null;
  mode: OfficeViewMode;
  webgl: boolean;
  weak: boolean;
  onSelect: (id: string | null) => void;
  onMode: (mode: OfficeViewMode) => void;
  onReset: () => void;
  onSnapshot: (snapshot: OfficeSnapshot) => void;
  children: ReactNode;
}) {
  const [division, setDivision] = useState<(typeof DIVISIONS)[number]["id"]>("semua");
  const [navOpen, setNavOpen] = useState(false);
  const visible = division === "semua" ? snapshot.agents : snapshot.agents.filter((agent) => agent.division === division);
  const critical = snapshot.products.filter((p) => p.stock <= p.min_stock).length;
  const greetName = userName.trim() || "Founder";

  const nav = (
    <aside className="flex h-full w-full flex-col bg-white">
      <div className="flex items-center gap-2.5 border-b border-[#E8E4F2] px-4 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-gercep.png" alt="" className="h-9 w-9 rounded-xl object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#1A1630]">Henima Kantor AI</p>
          <p className="truncate text-[10px] text-[#7A7594]">{businessName}</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <div>
          <p className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.12em] text-[#9B96B0] uppercase">Divisi</p>
          <div className="space-y-0.5">
            {DIVISIONS.map((item) => {
              const active = division === item.id;
              const Icon = item.icon;
              const count = item.id === "semua" ? snapshot.agents.length : snapshot.agents.filter((a) => a.division === item.id).length;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setDivision(item.id);
                    setNavOpen(false);
                  }}
                  className={[
                    "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-semibold",
                    active ? "bg-[#7C3AED]/12 text-[#6D28D9]" : "text-[#5B5678] hover:bg-[#F3F0F8]",
                  ].join(" ")}
                >
                  <Icon size={16} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="text-[10px] text-[#9B96B0]">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.12em] text-[#9B96B0] uppercase">Agen</p>
          <div className="space-y-1">
            {visible.map((agent) => {
              const active = selected?.id === agent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    onSelect(active ? null : agent.id);
                    setNavOpen(false);
                  }}
                  className={[
                    "w-full rounded-xl border px-2.5 py-2 text-left",
                    active ? "border-[#7C3AED]/35 bg-[#7C3AED]/8" : "border-transparent bg-[#F7F5FB] hover:border-[#E8E4F2]",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: agent.color }} />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#1A1630]">{agent.name}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_CLASS[agent.status]}`}>
                      {STATUS_LABEL[agent.status]}
                    </span>
                  </span>
                  <span className="mt-1 line-clamp-2 block pl-[18px] text-[10px] leading-snug text-[#7A7594]">{taskLine(agent)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="space-y-2 border-t border-[#E8E4F2] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link
          href="/dashboard/owner"
          className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#7A7594] hover:bg-[#F3F0F8]"
        >
          <HelpCircle size={14} />
          Dashboard Gercep
        </Link>
        <div className="flex items-center gap-2.5 rounded-xl bg-[#F7F5FB] px-2.5 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED] text-xs font-bold text-white">
            {greetName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[#1A1630]">{greetName}</p>
            <p className="text-[10px] text-[#9B96B0]">Founder</p>
          </div>
          <button
            type="button"
            title="Keluar"
            onClick={() => void logout()}
            className="rounded-lg p-1.5 text-[#9B96B0] hover:bg-white hover:text-[#DC2626]"
          >
            <LogOut size={14} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-xs font-bold text-[#DC2626]"
        >
          <LogOut size={14} />
          Keluar
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F3F0F8] text-[#1A1630]">
      {/* Mobile top */}
      <div
        className="flex shrink-0 items-center justify-between border-b border-[#E8E4F2] bg-white px-3 py-2.5 lg:hidden"
        style={{ paddingTop: "max(0.65rem, env(safe-area-inset-top))" }}
      >
        <button type="button" onClick={() => setNavOpen(true)} className="rounded-xl border border-[#E8E4F2] p-2" aria-label="Menu">
          <Menu size={18} />
        </button>
        <p className="text-sm font-bold">Henima Kantor AI</p>
        <button type="button" onClick={() => void logout()} className="rounded-xl border border-[#FECACA] px-2.5 py-1.5 text-[11px] font-bold text-[#DC2626]">
          Keluar
        </button>
      </div>

      {navOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Tutup" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(19rem,88vw)] overflow-hidden bg-white shadow-xl">{nav}</div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[240px] shrink-0 border-r border-[#E8E4F2] bg-white lg:block">{nav}</div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="hidden shrink-0 border-b border-[#E8E4F2] bg-white/90 px-5 py-4 backdrop-blur lg:block">
            <p className="text-lg font-bold tracking-tight">Selamat datang, {greetName}!</p>
            <p className="text-sm text-[#7A7594]">Kelola agen Kantor AI Henima dalam satu tempat.</p>
          </header>

          <div className="grid shrink-0 grid-cols-2 gap-2 px-3 pt-3 sm:grid-cols-4 lg:gap-3 lg:px-5">
            <Stat label="Total Agen" value={String(snapshot.crew_total)} />
            <Stat label="Agen Aktif" value={String(snapshot.crew_active)} />
            <Stat label="Tugas Berjalan" value={String(snapshot.tasks_running)} />
            <Stat label="Stok Kritis" value={String(critical)} />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row lg:px-5 lg:pb-5">
            <section className="relative min-h-[42vh] min-w-0 flex-1 overflow-hidden rounded-2xl border border-[#E8E4F2] bg-white shadow-[0_12px_40px_rgba(28,20,60,0.06)] lg:min-h-0">
              <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-2">
                <div className="flex rounded-xl border border-[#E8E4F2] bg-white/95 p-1 shadow-sm">
                  {(["3d", "2d"] as const).map((value) => {
                    const disabled = value === "3d" && !webgl;
                    const active = mode === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={disabled}
                        onClick={() => onMode(value)}
                        className={[
                          "rounded-lg px-2.5 py-1 text-[11px] font-bold",
                          active ? "bg-[#7C3AED] text-white" : "text-[#7A7594]",
                          disabled ? "opacity-40" : "",
                        ].join(" ")}
                      >
                        {value.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={onReset} className="rounded-xl border border-[#E8E4F2] bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#5B5678] shadow-sm">
                  Semua ruang
                </button>
              </div>
              <div className="absolute top-3 right-3 z-20 max-w-[11rem] rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] px-3 py-2 text-white shadow-lg">
                <p className="text-[11px] font-semibold leading-snug">Semangat hari ini, {greetName}! Agen siap membantu bisnis kamu.</p>
              </div>
              {weak ? <p className="absolute bottom-3 left-3 z-20 rounded-lg bg-white/90 px-2 py-1 text-[10px] text-[#7A7594]">Mode ringan aktif</p> : null}
              <div className="absolute inset-0">{children}</div>
            </section>

            <aside className="flex max-h-[42vh] w-full shrink-0 flex-col gap-3 overflow-y-auto lg:max-h-none lg:w-[300px]">
              <div className="rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] p-4 text-white shadow-lg">
                <p className="text-sm font-bold">Status Kantor</p>
                <p className="mt-1 text-xs leading-relaxed text-white/85">
                  {snapshot.crew_active} agen bekerja · {snapshot.tasks_running} tugas aktif
                  {critical ? ` · ${critical} produk kritis` : " · stok aman"}
                </p>
                {snapshot.notices[0] ? <p className="mt-2 line-clamp-2 text-[11px] text-amber-100">{snapshot.notices[0]}</p> : null}
              </div>

              <div className="rounded-2xl border border-[#E8E4F2] bg-white p-3 shadow-sm">
                <p className="text-[10px] font-semibold tracking-[0.12em] text-[#9B96B0] uppercase">Aktivitas Terbaru</p>
                <ul className="mt-2 space-y-2">
                  {visible.slice(0, 5).map((agent) => (
                    <li key={agent.id}>
                      <button type="button" onClick={() => onSelect(agent.id)} className="w-full rounded-xl bg-[#F7F5FB] px-2.5 py-2 text-left hover:bg-[#F0ECF8]">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: agent.color }} />
                          <span className="truncate text-xs font-bold text-[#1A1630]">{agent.name}</span>
                          <span className="text-[10px] text-[#9B96B0]">{DIVISION_LABEL[agent.division]}</span>
                        </span>
                        <span className="mt-1 line-clamp-2 block text-[10px] leading-snug text-[#7A7594]">{taskLine(agent)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {selected ? (
                <div className="rounded-2xl border border-[#2A2438] bg-[#151921] p-3 text-slate-100 shadow-sm">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase">Detail Agen</p>
                      <h2 className="truncate text-sm font-bold text-white">{selected.name}</h2>
                      <p className="text-[11px] text-slate-400">{placeLine(selected)}</p>
                    </div>
                    <button type="button" aria-label="Tutup" onClick={() => onSelect(null)} className="rounded-lg border border-white/10 p-1.5 text-slate-400">
                      <X size={14} />
                    </button>
                  </div>
                  <p className="mb-2 line-clamp-2 text-[11px] text-slate-400">{statusMeaning(selected)}</p>
                  <div className="max-h-[40vh] overflow-y-auto">
                    <OfficeWorkPanel key={selected.id} agent={selected} snapshot={snapshot} onSnapshot={onSnapshot} />
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E8E4F2] bg-white px-3 py-3 shadow-sm">
      <p className="text-[10px] font-semibold tracking-wide text-[#9B96B0] uppercase">{label}</p>
      <p className="mt-1 text-xl font-bold text-[#1A1630]">{value}</p>
    </div>
  );
}
