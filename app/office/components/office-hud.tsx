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
  Users,
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
  { id: "hr", label: "HR", icon: Users },
];

const STATUS_CLASS: Record<AgentStatus, string> = {
  working: "bg-emerald-100 text-emerald-700",
  idle: "bg-sky-100 text-sky-700",
  error: "bg-amber-100 text-amber-700",
};

type StageMode = "showcase" | OfficeViewMode;

async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  clearFastGateCookies();
  window.location.assign("/login");
}

function sparkPath(seed: number, amp = 16) {
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
  const [stage, setStage] = useState<StageMode>("showcase");
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
    const vals = [22, 30, 38, 52, 46, 60, 70, 64, 78, 86, 80, Math.max(45, productivity)];
    return vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${100 - v}`).join(" ");
  }, [productivity]);

  const setLive = (value: OfficeViewMode) => {
    setStage(value);
    onMode(value);
  };

  const nav = (
    <aside className="flex h-full w-full flex-col bg-[linear-gradient(180deg,#3B2468_0%,#241544_42%,#1A1033_100%)] text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-gercep.png" alt="" className="h-10 w-10 rounded-2xl object-cover ring-2 ring-[#A78BFA]/45" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold tracking-tight">Henima Kantor AI</p>
          <p className="truncate text-[10px] text-[#C4B5FD]/80">{businessName}</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
        <div>
          <p className="mb-2 px-2 text-[10px] font-semibold tracking-[0.16em] text-[#A78BFA]/75 uppercase">Divisi</p>
          <div className="space-y-1">
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
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition",
                    active ? "bg-white/15 text-white shadow-[inset_0_0_0_1px_rgba(196,181,253,0.35)]" : "text-[#DDD6FE]/80 hover:bg-white/8",
                  ].join(" ")}
                >
                  <Icon size={17} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="text-[10px] text-[#C4B5FD]/70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 px-2 text-[10px] font-semibold tracking-[0.16em] text-[#A78BFA]/75 uppercase">Agen</p>
          <div className="space-y-1.5">
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
                    "w-full rounded-2xl border px-3 py-2.5 text-left transition",
                    active ? "border-[#C4B5FD]/45 bg-white/12" : "border-transparent bg-white/[0.05] hover:bg-white/[0.09]",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: agent.color }} />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">{agent.name}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_CLASS[agent.status]}`}>
                      {STATUS_LABEL[agent.status]}
                    </span>
                  </span>
                  <span className="mt-1 line-clamp-2 block pl-[18px] text-[10px] leading-snug text-[#DDD6FE]/65">{taskLine(agent)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="space-y-2 border-t border-white/10 px-3 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
        <Link href="/dashboard/owner" className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#DDD6FE]/75 hover:bg-white/8">
          <HelpCircle size={14} />
          Dashboard Gercep
        </Link>
        <div className="flex items-center gap-2.5 rounded-2xl bg-white/10 px-2.5 py-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED] text-xs font-bold">
            {greetName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold">{greetName}</p>
            <p className="text-[10px] text-[#C4B5FD]/70">Founder</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-500/20 px-3 py-2.5 text-xs font-bold text-rose-50"
        >
          <LogOut size={14} />
          Keluar
        </button>
      </div>
    </aside>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden text-[#1B1633]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 18% 8%, rgba(196,181,253,0.45), transparent 58%), radial-gradient(ellipse 55% 45% at 88% 5%, rgba(147,197,253,0.35), transparent 52%), linear-gradient(165deg, #F5F3FF 0%, #EEF2FF 40%, #F8F7FC 100%)",
        }}
      />

      <div
        className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/60 bg-white/55 px-3 py-2.5 backdrop-blur-xl lg:hidden"
        style={{ paddingTop: "max(0.65rem, env(safe-area-inset-top))" }}
      >
        <button type="button" onClick={() => setNavOpen(true)} className="rounded-xl border border-[#E8E4F2] bg-white/90 p-2" aria-label="Menu">
          <Menu size={18} />
        </button>
        <p className="text-sm font-bold">Henima Kantor AI</p>
        <button type="button" onClick={() => void logout()} className="rounded-xl border border-[#FECACA] bg-white/90 px-2.5 py-1.5 text-[11px] font-bold text-[#DC2626]">
          Keluar
        </button>
      </div>

      {navOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/45" aria-label="Tutup" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(19rem,88vw)] overflow-hidden shadow-2xl">{nav}</div>
        </div>
      ) : null}

      <div className="relative z-10 flex min-h-0 flex-1">
        <div className="hidden w-[252px] shrink-0 overflow-hidden lg:block">{nav}</div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="hidden shrink-0 items-center gap-4 border-b border-white/70 bg-white/50 px-6 py-4 backdrop-blur-xl lg:flex">
            <div className="min-w-[220px] shrink-0">
              <p className="text-[22px] leading-tight font-bold tracking-tight">Selamat datang, {greetName}!</p>
              <p className="mt-0.5 text-sm text-[#6F6A8C]">Kelola semua AI Agent Anda dalam satu tempat.</p>
            </div>
            <label className="mx-auto flex w-full max-w-xl items-center gap-2 rounded-full border border-white bg-white/85 px-4 py-2.5 shadow-[0_8px_30px_rgba(80,50,140,0.08)]">
              <Search size={16} className="text-[#9B96B0]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari agent, proyek atau fitur..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9B96B0]"
              />
              <kbd className="rounded-lg border border-[#E8E4F2] bg-[#F5F3FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#9B96B0]">⌘K</kbd>
            </label>
            <div className="flex shrink-0 items-center gap-2">
              {[Sun, Bell, Maximize2].map((Icon, i) => (
                <span key={i} className="relative grid h-10 w-10 place-items-center rounded-2xl border border-white bg-white/80 text-[#7A7594] shadow-sm">
                  <Icon size={16} />
                  {i === 1 && snapshot.notices.length ? <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" /> : null}
                </span>
              ))}
            </div>
          </header>

          <div className="grid shrink-0 grid-cols-2 gap-2.5 px-3 pt-3 sm:grid-cols-4 lg:gap-3 lg:px-6">
            <Stat label="Total Agent" value={String(snapshot.crew_total)} trend="+12%" seed={1} />
            <Stat label="Agent Aktif" value={String(snapshot.crew_active)} trend="+20%" seed={2} />
            <Stat label="Proyek Berjalan" value={String(Math.max(snapshot.tasks_running, 1))} trend="+8%" seed={3} />
            <Stat label="Penggunaan AI" value={`${usage || 92}%`} trend="+5%" seed={4} />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:overflow-hidden lg:px-6 lg:pt-3 lg:pb-4">
            <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
              <section className="relative min-h-[52vh] min-w-0 flex-1 overflow-hidden rounded-[28px] border border-white/80 bg-[#F4F1FB] shadow-[0_28px_80px_rgba(70,40,130,0.12)] lg:min-h-0">
                <div className="absolute top-3 left-3 z-30 flex flex-wrap gap-2">
                  <div className="flex rounded-2xl border border-white/90 bg-white/95 p-1 shadow-sm">
                    {(
                      [
                        { id: "showcase" as const, label: "Kantor" },
                        { id: "3d" as const, label: "Live 3D" },
                        { id: "2d" as const, label: "2D" },
                      ] as const
                    ).map((item) => {
                      const disabled = item.id === "3d" && !webgl;
                      const isOn = stage === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (item.id === "showcase") setStage("showcase");
                            else setLive(item.id);
                          }}
                          className={[
                            "rounded-xl px-2.5 py-1 text-[11px] font-bold",
                            isOn ? "bg-[#7C3AED] text-white" : "text-[#7A7594]",
                            disabled ? "opacity-40" : "",
                          ].join(" ")}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                  {stage !== "showcase" ? (
                    <button type="button" onClick={onReset} className="rounded-2xl border border-white/90 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#5B5678] shadow-sm">
                      Semua ruang
                    </button>
                  ) : null}
                </div>

                {stage === "showcase" ? (
                  <>
                    {/* Exact mock visual: founder + isometric office (Henima hologram) */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/office-henima-hero.jpg"
                      alt="Kantor AI Henima"
                      className="absolute inset-0 h-full w-full object-cover object-[12%_60%] sm:object-[18%_55%] lg:object-center"
                      draggable={false}
                    />
                    {/* Personalized bubble over baked-in bubble */}
                    <div className="pointer-events-none absolute top-[10%] left-[min(34%,12rem)] z-20 w-[min(13.5rem,42vw)] sm:left-[36%] lg:left-[34%]">
                      <div className="rounded-[22px] bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] px-3.5 py-3 text-white shadow-[0_16px_40px_rgba(91,33,182,0.45)]">
                        <p className="text-[12px] font-bold leading-snug sm:text-[13px]">Semangat hari ini, {greetName}!</p>
                        <p className="mt-1 text-[10px] leading-snug text-violet-100 sm:text-[11px]">Henima Agent siap membantu bisnis Anda.</p>
                      </div>
                      <div className="ml-4 h-0 w-0 border-t-[10px] border-r-[12px] border-t-transparent border-r-[#6D28D9]" />
                    </div>
                    <button
                      type="button"
                      aria-label="Pilih agen aktif"
                      className="absolute top-[18%] right-[8%] z-20 h-[28%] w-[28%] rounded-3xl bg-transparent"
                      onClick={() => {
                        const first = visible.find((a) => a.status === "working") ?? visible[0];
                        if (first) onSelect(first.id);
                      }}
                    />
                  </>
                ) : (
                  <>
                    {weak ? <p className="absolute bottom-3 left-3 z-30 rounded-lg bg-white/90 px-2 py-1 text-[10px] text-[#7A7594]">Mode ringan aktif</p> : null}
                    <div className="absolute inset-0">{children}</div>
                  </>
                )}
              </section>

              <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[300px] lg:overflow-y-auto">
                <div className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(145deg,#A78BFA_0%,#7C3AED_45%,#5B21B6_100%)] p-4 text-white shadow-[0_20px_50px_rgba(91,33,182,0.35)]">
                  <div className="pointer-events-none absolute -top-10 -right-8 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                    <span className="relative block h-7 w-7 rounded-xl bg-white/90">
                      <span className="absolute top-2 left-1.5 h-1.5 w-1.5 rounded-full bg-[#7C3AED]" />
                      <span className="absolute top-2 right-1.5 h-1.5 w-1.5 rounded-full bg-[#7C3AED]" />
                      <span className="absolute bottom-1.5 left-1/2 h-1 w-3 -translate-x-1/2 rounded-full bg-[#C4B5FD]" />
                    </span>
                  </div>
                  <p className="text-sm font-bold">AI Agent Anda berjalan dengan optimal!</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/85">
                    {snapshot.crew_active} agen bekerja · {snapshot.tasks_running} tugas aktif
                    {critical ? ` · ${critical} stok kritis` : " · stok aman"}
                  </p>
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

                <div className="rounded-[26px] border border-white/80 bg-white/75 p-3 shadow-sm backdrop-blur">
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-[#9B96B0] uppercase">Aktivitas Terbaru</p>
                  <ul className="mt-2 space-y-2">
                    {visible.slice(0, 5).map((agent, index) => (
                      <li key={agent.id}>
                        <button type="button" onClick={() => onSelect(agent.id)} className="w-full rounded-2xl bg-[#F5F3FF] px-3 py-2.5 text-left hover:bg-[#EDE9FE]">
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ background: agent.color }} />
                              <span className="truncate text-xs font-bold text-[#1B1633]">{agent.name}</span>
                            </span>
                            <span className="shrink-0 text-[10px] text-[#9B96B0]">{(index + 1) * 2 + 1} mnt</span>
                          </span>
                          <span className="mt-1 line-clamp-2 block text-[10px] leading-snug text-[#7A7594]">{taskLine(agent)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {selected ? (
                  <div className="rounded-[26px] border border-[#2A2438] bg-[#151921] p-3 text-slate-100 shadow-sm">
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
                    <div className="max-h-[34vh] overflow-y-auto">
                      <OfficeWorkPanel key={selected.id} agent={selected} snapshot={snapshot} onSnapshot={onSnapshot} />
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>

            <div className="hidden shrink-0 gap-3 lg:grid lg:grid-cols-[1.45fr_1fr]">
              <div className="rounded-[26px] border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">Ringkasan Kinerja</p>
                  <div className="flex gap-1">
                    {["Hari Ini", "7 Hari", "30 Hari", "Custom"].map((label, i) => (
                      <span key={label} className={["rounded-lg px-2.5 py-1 text-[10px] font-bold", i === 0 ? "bg-[#7C3AED] text-white" : "bg-[#F3F0F8] text-[#7A7594]"].join(" ")}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <svg viewBox="0 0 100 100" className="h-32 w-full" preserveAspectRatio="none" aria-hidden>
                  <defs>
                    <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polyline fill="url(#perfFill)" stroke="none" points={`0,100 ${chart} 100,100`} />
                  <polyline fill="none" stroke="#7C3AED" strokeWidth="2" points={chart} />
                </svg>
                <div className="mt-1 flex justify-between text-[10px] font-semibold text-[#9B96B0]">
                  <span>08:00</span>
                  <span>12:00</span>
                  <span>16:00</span>
                  <span>20:00</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
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
    <div className="rounded-[22px] border border-white/90 bg-white/80 px-3.5 py-3.5 shadow-[0_12px_34px_rgba(70,40,130,0.07)] backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-[#9B96B0] uppercase">{label}</p>
          <p className="mt-1 text-[22px] font-bold tracking-tight text-[#1B1633]">{value}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">{trend}</p>
        </div>
        <svg width="72" height="28" viewBox="0 0 72 28" aria-hidden className="mt-1 opacity-90">
          <polyline fill="none" stroke="#8B5CF6" strokeWidth="2.2" points={sparkPath(seed)} />
        </svg>
      </div>
    </div>
  );
}

function Mini({ label, value, seed }: { label: string; value: string; seed: number }) {
  return (
    <div className="rounded-[22px] border border-white/90 bg-white/80 px-3 py-3 shadow-sm backdrop-blur">
      <p className="text-[10px] font-semibold text-[#9B96B0] uppercase">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#1B1633]">{value}</p>
      <svg width="100%" height="24" viewBox="0 0 72 28" preserveAspectRatio="none" aria-hidden className="mt-1">
        <polyline fill="none" stroke="#A78BFA" strokeWidth="2" points={sparkPath(seed, 14)} />
      </svg>
    </div>
  );
}
