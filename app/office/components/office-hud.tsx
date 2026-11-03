"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  Building2,
  Code2,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Maximize2,
  Megaphone,
  Menu,
  Search,
  Share2,
  Sun,
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

function sparkPath(seed: number, amp = 18) {
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const x = (i / 7) * 72;
    const y = 22 - ((Math.sin(seed + i * 0.9) + 1) / 2) * amp - (i % 3);
    pts.push(`${x},${y}`);
  }
  return pts.join(" ");
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
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const base = division === "semua" ? snapshot.agents : snapshot.agents.filter((agent) => agent.division === division);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((a) => a.name.toLowerCase().includes(q) || DIVISION_LABEL[a.division].toLowerCase().includes(q));
  }, [division, query, snapshot.agents]);
  const critical = snapshot.products.filter((p) => p.stock <= p.min_stock).length;
  const greetName = userName.trim() || "Founder";
  const usage = Math.min(99, Math.round((snapshot.crew_active / Math.max(1, snapshot.crew_total)) * 100) || 0);
  const productivity = Math.min(99, 72 + snapshot.crew_active * 4 + snapshot.tasks_running * 3);
  const chart = useMemo(() => {
    const vals = [18, 28, 34, 48, 42, 58, 66, 61, 74, 82, 78, Math.max(40, productivity)];
    return vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${100 - v}`).join(" ");
  }, [productivity]);

  const nav = (
    <aside className="flex h-full w-full flex-col bg-gradient-to-b from-[#2A1B4A] via-[#1C1433] to-[#151028] text-white">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-gercep.png" alt="" className="h-9 w-9 rounded-xl object-cover ring-2 ring-violet-400/40" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight">Henima Kantor AI</p>
          <p className="truncate text-[10px] text-violet-200/70">{businessName}</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <div>
          <p className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.14em] text-violet-300/70 uppercase">Divisi</p>
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
                    "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-semibold transition",
                    active ? "bg-white/15 text-white shadow-[inset_0_0_0_1px_rgba(167,139,250,0.35)]" : "text-violet-100/75 hover:bg-white/8",
                  ].join(" ")}
                >
                  <Icon size={16} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="text-[10px] text-violet-200/60">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.14em] text-violet-300/70 uppercase">Agen</p>
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
                    "w-full rounded-xl border px-2.5 py-2 text-left transition",
                    active ? "border-violet-300/40 bg-white/12" : "border-transparent bg-white/[0.04] hover:bg-white/[0.08]",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: agent.color }} />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">{agent.name}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_CLASS[agent.status]}`}>
                      {STATUS_LABEL[agent.status]}
                    </span>
                  </span>
                  <span className="mt-1 line-clamp-2 block pl-[18px] text-[10px] leading-snug text-violet-100/60">{taskLine(agent)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="space-y-2 border-t border-white/10 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link href="/dashboard/owner" className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-violet-100/70 hover:bg-white/8">
          <HelpCircle size={14} />
          Dashboard Gercep
        </Link>
        <div className="flex items-center gap-2.5 rounded-xl bg-white/8 px-2.5 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED] text-xs font-bold text-white">
            {greetName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{greetName}</p>
            <p className="text-[10px] text-violet-200/60">Founder</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-500/15 px-3 py-2.5 text-xs font-bold text-rose-100"
        >
          <LogOut size={14} />
          Keluar
        </button>
      </div>
    </aside>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden text-[#1A1630]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 15% 10%, rgba(167,139,250,0.35), transparent 55%), radial-gradient(ellipse 70% 50% at 85% 0%, rgba(96,165,250,0.28), transparent 50%), radial-gradient(ellipse 60% 45% at 70% 90%, rgba(244,114,182,0.18), transparent 55%), linear-gradient(160deg, #F7F4FF 0%, #EEF2FF 45%, #F8F5FF 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: "url(/office-smart-bg.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(28px) saturate(1.15)",
        }}
      />

      <div
        className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/50 bg-white/55 px-3 py-2.5 backdrop-blur-xl lg:hidden"
        style={{ paddingTop: "max(0.65rem, env(safe-area-inset-top))" }}
      >
        <button type="button" onClick={() => setNavOpen(true)} className="rounded-xl border border-[#E8E4F2] bg-white/80 p-2" aria-label="Menu">
          <Menu size={18} />
        </button>
        <p className="text-sm font-bold">Henima Kantor AI</p>
        <button type="button" onClick={() => void logout()} className="rounded-xl border border-[#FECACA] bg-white/80 px-2.5 py-1.5 text-[11px] font-bold text-[#DC2626]">
          Keluar
        </button>
      </div>

      {navOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Tutup" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(19rem,88vw)] overflow-hidden shadow-2xl">{nav}</div>
        </div>
      ) : null}

      <div className="relative z-10 flex min-h-0 flex-1">
        <div className="hidden w-[248px] shrink-0 overflow-hidden rounded-none shadow-[8px_0_40px_rgba(40,20,80,0.12)] lg:block">{nav}</div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="hidden shrink-0 items-center gap-4 border-b border-white/60 bg-white/45 px-5 py-3.5 backdrop-blur-xl lg:flex">
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold tracking-tight text-[#1A1630]">Selamat datang, {greetName}!</p>
              <p className="text-sm text-[#6B6688]">Kelola semua AI Agent Anda dalam satu tempat.</p>
            </div>
            <label className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-white/80 bg-white/80 px-3 py-2.5 shadow-sm">
              <Search size={16} className="text-[#9B96B0]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari agent, proyek atau fitur..."
                className="min-w-0 flex-1 bg-transparent text-sm text-[#1A1630] outline-none placeholder:text-[#9B96B0]"
              />
              <kbd className="rounded-md border border-[#E8E4F2] bg-[#F7F5FB] px-1.5 py-0.5 text-[10px] font-semibold text-[#9B96B0]">⌘K</kbd>
            </label>
            <div className="flex items-center gap-1.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/80 bg-white/70 text-[#7A7594]"><Sun size={16} /></span>
              <span className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/80 bg-white/70 text-[#7A7594]">
                <Bell size={16} />
                {snapshot.notices.length ? <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" /> : null}
              </span>
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/80 bg-white/70 text-[#7A7594]"><Maximize2 size={16} /></span>
            </div>
          </header>

          <div className="grid shrink-0 grid-cols-2 gap-2 px-3 pt-3 sm:grid-cols-4 lg:gap-3 lg:px-5">
            <Stat label="Total Agent" value={String(snapshot.crew_total)} trend="+12%" seed={1} />
            <Stat label="Agent Aktif" value={String(snapshot.crew_active)} trend="+20%" seed={2} />
            <Stat label="Proyek Berjalan" value={String(snapshot.tasks_running)} trend="+8%" seed={3} />
            <Stat label="Penggunaan AI" value={`${usage}%`} trend="+5%" seed={4} />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:overflow-hidden lg:px-5 lg:pb-4">
            <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
              <section className="relative min-h-[48vh] min-w-0 flex-1 overflow-hidden rounded-[28px] border border-white/70 bg-white/55 shadow-[0_24px_80px_rgba(60,40,120,0.12)] backdrop-blur-md lg:min-h-0">
                <div
                  className="pointer-events-none absolute inset-0 opacity-70"
                  style={{
                    background:
                      "radial-gradient(circle at 70% 45%, rgba(139,92,246,0.14), transparent 42%), radial-gradient(circle at 30% 80%, rgba(56,189,248,0.12), transparent 40%), linear-gradient(180deg, rgba(255,255,255,0.35), rgba(243,240,255,0.55))",
                  }}
                />

                <div className="absolute top-3 left-3 z-30 flex flex-wrap gap-2">
                  <div className="flex rounded-xl border border-white/80 bg-white/90 p-1 shadow-sm">
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
                  <button type="button" onClick={onReset} className="rounded-xl border border-white/80 bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#5B5678] shadow-sm">
                    Semua ruang
                  </button>
                </div>

                {/* Founder mascot + bubble — like the mock */}
                <div className="pointer-events-none absolute bottom-0 left-0 z-20 flex h-full max-w-[42%] items-end pl-1 sm:max-w-[36%] lg:max-w-[280px]">
                  <div className="relative">
                    <div className="absolute top-[8%] left-[72%] z-10 w-[min(11rem,48vw)] sm:left-[78%]">
                      <div className="rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] px-3 py-2.5 text-white shadow-[0_12px_30px_rgba(91,33,182,0.45)]">
                        <p className="text-[11px] font-semibold leading-snug sm:text-xs">
                          Semangat hari ini, {greetName}! Agen Henima siap membantu bisnis Anda.
                        </p>
                      </div>
                      <div className="ml-3 h-0 w-0 border-t-8 border-r-8 border-t-transparent border-r-[#6D28D9]" />
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/office-founder-mascot.png"
                      alt=""
                      className="relative z-0 h-[min(52vh,420px)] w-auto max-w-none object-contain drop-shadow-[0_20px_40px_rgba(40,20,80,0.25)] select-none"
                      draggable={false}
                    />
                  </div>
                </div>

                {weak ? <p className="absolute bottom-3 left-3 z-30 rounded-lg bg-white/90 px-2 py-1 text-[10px] text-[#7A7594]">Mode ringan aktif</p> : null}
                <div className="absolute inset-0 z-10">{children}</div>
              </section>

              <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[300px] lg:overflow-y-auto">
                <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#8B5CF6] via-[#7C3AED] to-[#4F46E5] p-4 text-white shadow-[0_18px_50px_rgba(91,33,182,0.35)]">
                  <div className="pointer-events-none absolute -top-8 -right-6 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
                  <p className="text-sm font-bold">Status Kantor</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/90">
                    AI Agent Anda berjalan dengan optimal!
                  </p>
                  <p className="mt-2 text-[11px] text-violet-100/90">
                    {snapshot.crew_active} agen bekerja · {snapshot.tasks_running} tugas aktif
                    {critical ? ` · ${critical} produk kritis` : " · stok aman"}
                  </p>
                  {snapshot.notices[0] ? <p className="mt-2 line-clamp-2 text-[11px] text-amber-100">{snapshot.notices[0]}</p> : null}
                  <button
                    type="button"
                    onClick={() => {
                      const first = visible[0];
                      if (first) onSelect(first.id);
                    }}
                    className="mt-3 rounded-xl bg-white/20 px-3 py-2 text-xs font-bold backdrop-blur hover:bg-white/30"
                  >
                    Lihat Detail →
                  </button>
                </div>

                <div className="rounded-[24px] border border-white/70 bg-white/70 p-3 shadow-sm backdrop-blur">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-[#9B96B0] uppercase">Aktivitas Terbaru</p>
                  <ul className="mt-2 space-y-2">
                    {visible.slice(0, 5).map((agent) => (
                      <li key={agent.id}>
                        <button type="button" onClick={() => onSelect(agent.id)} className="w-full rounded-xl bg-[#F7F5FB]/90 px-2.5 py-2 text-left hover:bg-[#EFEAFF]">
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
                  <div className="rounded-[24px] border border-[#2A2438] bg-[#151921] p-3 text-slate-100 shadow-sm">
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
                    <div className="max-h-[36vh] overflow-y-auto">
                      <OfficeWorkPanel key={selected.id} agent={selected} snapshot={snapshot} onSnapshot={onSnapshot} />
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>

            <div className="hidden shrink-0 gap-3 lg:grid lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[#1A1630]">Ringkasan Kinerja</p>
                  <div className="flex gap-1">
                    {["Hari Ini", "7 Hari", "30 Hari"].map((label, i) => (
                      <span key={label} className={["rounded-lg px-2 py-1 text-[10px] font-bold", i === 0 ? "bg-[#7C3AED] text-white" : "bg-[#F3F0F8] text-[#7A7594]"].join(" ")}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <svg viewBox="0 0 100 100" className="h-28 w-full" preserveAspectRatio="none" aria-hidden>
                  <defs>
                    <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polyline fill="url(#perfFill)" stroke="none" points={`0,100 ${chart} 100,100`} />
                  <polyline fill="none" stroke="#7C3AED" strokeWidth="1.8" points={chart} />
                </svg>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Mini label="Produktivitas" value={`${productivity}%`} seed={5} />
                <Mini label="Waktu Aktif" value={`${(8 + snapshot.crew_active * 1.5).toFixed(1)} Jam`} seed={6} />
                <Mini label="Tim Aktif" value={`${snapshot.crew_total} Orang`} seed={7} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, trend, seed }: { label: string; value: string; trend: string; seed: number }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/75 px-3 py-3 shadow-[0_10px_30px_rgba(60,40,120,0.06)] backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-[#9B96B0] uppercase">{label}</p>
          <p className="mt-1 text-xl font-bold text-[#1A1630]">{value}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">{trend}</p>
        </div>
        <svg width="72" height="28" viewBox="0 0 72 28" aria-hidden className="mt-1 opacity-80">
          <polyline fill="none" stroke="#8B5CF6" strokeWidth="2" points={sparkPath(seed)} />
        </svg>
      </div>
    </div>
  );
}

function Mini({ label, value, seed }: { label: string; value: string; seed: number }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/75 px-3 py-3 shadow-sm backdrop-blur">
      <p className="text-[10px] font-semibold text-[#9B96B0] uppercase">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#1A1630]">{value}</p>
      <svg width="100%" height="24" viewBox="0 0 72 28" preserveAspectRatio="none" aria-hidden className="mt-1">
        <polyline fill="none" stroke="#A78BFA" strokeWidth="2" points={sparkPath(seed, 14)} />
      </svg>
    </div>
  );
}
