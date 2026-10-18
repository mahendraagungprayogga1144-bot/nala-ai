"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AudioLines,
  ArrowUp,
  BookOpen,
  Clock,
  Compass,
  FileText,
  Globe,
  ImageIcon,
  Library,
  Lightbulb,
  Menu,
  Mic,
  PanelLeft,
  Paperclip,
  Pencil,
  Plus,
  Presentation,
  Puzzle,
  Search,
  Shapes,
  Sparkles,
  SquarePen,
  Telescope,
  X,
} from "lucide-react";

type Role = "user" | "assistant";
type ChatMsg = { role: Role; content: string };
type Thread = {
  id: string;
  title: string;
  updatedAt: number;
  projectId?: string;
  messages: ChatMsg[];
};
type Saved = { id: string; title: string; body: string; at: number };
type Schedule = { id: string; title: string; when: string; note: string };
type ModeId = "image" | "write" | "web" | "research" | "sketch" | "template" | "slides" | "pdf";
type Panel = "home" | "work" | "terjadwal" | "pustaka" | "plugin" | "astra" | "jelajah";
type Attachment = { name: string; text?: string; image?: { mediaType: string; data: string } };

const THREAD_KEY = "henima-ai-threads-v1";
const LIBRARY_KEY = "henima-ai-library-v1";
const SCHEDULE_KEY = "henima-ai-schedules-v1";

const PROJECTS = [
  { id: "menulis", name: "Menulis", color: "#7C5CFC" },
  { id: "analisa", name: "Analisa", color: "#0F766E" },
];

const QUICK = [
  { mode: "image" as ModeId, label: "Buat gambar atau stiker", icon: ImageIcon },
  { mode: "write" as ModeId, label: "Tulis atau edit", icon: Pencil },
  { mode: "web" as ModeId, label: "Cari di web", icon: Globe },
];

const MODES: { id: ModeId; label: string; hint: string; placeholder: string }[] = [
  { id: "image", label: "Buat gambar", hint: "Visualisasikan apa saja", placeholder: "Jelaskan gambar atau stiker yang kamu mau" },
  { id: "web", label: "Pencarian web", hint: "Temukan berita dan info", placeholder: "Mau dicari apa?" },
  { id: "research", label: "Riset mendalam", hint: "Laporan terperinci", placeholder: "Topik riset yang mau dibedah" },
  { id: "sketch", label: "Sketsa", hint: "Gambar dan lampirkan", placeholder: "Jelaskan sketsa yang kamu mau" },
  { id: "template", label: "Template", hint: "Kerangka yang bisa dipakai ulang", placeholder: "Template apa yang perlu dibuat?" },
  { id: "slides", label: "Presentasi", hint: "Susun slide", placeholder: "Presentasi tentang apa?" },
  { id: "pdf", label: "PDF", hint: "Susun dokumen", placeholder: "Dokumen apa yang perlu disusun?" },
  { id: "write", label: "Tulis", hint: "Tulis atau edit teks", placeholder: "Tempel teks, atau bilang mau ditulis apa" },
];

const WORK = [
  { title: "Analisa penjualan", prompt: "Analisa penjualan dan omzet bisnis aktif dari data Gercep. Sebut angka yang ada, lalu 3 hal yang perlu diperhatikan." },
  { title: "Stok dan HPP", prompt: "Cek stok yang menipis dan bandingkan harga jual dengan modal dari data yang ada. Jangan mengarang angka." },
  { title: "Arus kas bulan ini", prompt: "Ringkas pemasukan, pengeluaran, dan selisih bulan ini. Tutup dengan satu saran yang paling penting." },
  { title: "Briefing tim", prompt: "Buat briefing singkat untuk tim hari ini berdasarkan data bisnis yang tersedia." },
  { title: "Ide konten", prompt: "Susun 5 ide konten promosi dari produk yang ada di inventory. Setiap ide satu kalimat." },
  { title: "Ringkas minggu ini", prompt: "Buat ringkasan kondisi bisnis minggu ini: yang jalan, yang seret, dan yang harus dikerjakan dulu." },
];

const EXPLORE = [
  "Produk mana yang paling menguras stok?",
  "Kalau pengeluaran tetap, kapan arus kas mulai sesak?",
  "Tulis caption promosi untuk produk termahal.",
  "Susun checklist tutup buku akhir bulan.",
  "Bandingkan omzet order dengan pemasukan keuangan.",
  "Buat outline presentasi kondisi bisnis untuk owner.",
];

function uid() {
  return crypto.randomUUID();
}

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function Mark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#111111" />
      <path d="M9 17.5c2.2-5.5 4.2-5.2 6.2-1.2 1.6 3.2 3.2 3.4 5.6.2" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="16" cy="13.2" r="1.7" fill="white" />
    </svg>
  );
}

function ThinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="1.35" fill="currentColor" />
    </svg>
  );
}

function renderAnswer(text: string) {
  return text.split("\n").map((line, i) => {
    const item = line.match(/^\s*[-•]\s+(.*)/);
    if (item) {
      return (
        <p key={i} className="pl-4">
          <span className="mr-2 text-[#8a8a8a]">•</span>
          {item[1]}
        </p>
      );
    }
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <p key={i}>{line}</p>;
  });
}

export default function HenimaAiClient({ userName }: { userName: string }) {
  const [ready, setReady] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [library, setLibrary] = useState<Saved[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("home");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ModeId | null>(null);
  const [think, setThink] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState("");
  const [userMenu, setUserMenu] = useState(false);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState({ title: "", when: "", note: "" });
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    setThreads(readStore<Thread[]>(THREAD_KEY, []));
    setLibrary(readStore<Saved[]>(LIBRARY_KEY, []));
    setSchedules(readStore<Schedule[]>(SCHEDULE_KEY, []));
    setReady(true);
    const prev = document.body.style.background;
    document.body.style.background = "#ffffff";
    return () => {
      document.body.style.background = prev;
      recRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(THREAD_KEY, JSON.stringify(threads));
  }, [threads, ready]);
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  }, [library, ready]);
  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedules));
  }, [schedules, ready]);

  const active = threads.find((t) => t.id === activeId) || null;
  const isEmptyHome = panel === "home" && !active;
  const rail = collapsed && !mobileNav;

  const visibleThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads
      .filter((t) => (projectId ? t.projectId === projectId : true))
      .filter((t) => (q ? t.title.toLowerCase().includes(q) : true))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [threads, projectId, query]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length, loading]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4600);
    return () => window.clearTimeout(t);
  }, [notice]);

  function openHome() {
    setActiveId(null);
    setPanel("home");
    setMobileNav(false);
    setPlusOpen(false);
    requestAnimationFrame(() => boxRef.current?.focus());
  }

  function openThread(id: string) {
    setActiveId(id);
    setPanel("home");
    setMobileNav(false);
  }

  async function onFile(file: File) {
    try {
    if (file.type.startsWith("image/")) {
      const image = await shrinkImage(file);
      setAttachment({ name: file.name, image });
      return;
    }
    if (file.type.startsWith("text/") || /\.(txt|csv|md|json)$/i.test(file.name)) {
      const text = (await file.text()).slice(0, 12000);
      setAttachment({ name: file.name, text });
      return;
    }
    setAttachment({
      name: file.name,
      text: `File ${file.name} terlampir. Isinya tidak bisa dibaca langsung. Minta user menempelkan bagian penting kalau perlu.`,
    });
    } catch {
      setNotice({ title: file.name, body: "File tidak bisa dibaca" });
    }
  }

  async function send(override?: string) {
    const typed = (override ?? input).trim();
    const extra = attachment?.text ? `\n\n[Lampiran ${attachment.name}]\n${attachment.text}` : "";
    const imageNote = attachment?.image ? `\n\n[Gambar terlampir: ${attachment.name}]` : "";
    const content = `${typed}${extra}${imageNote}`.trim();
    if ((!content && !attachment?.image) || loading) return;

    const visible = typed || (attachment ? `Lampiran: ${attachment.name}` : "");
    const userMsg: ChatMsg = { role: "user", content: visible };
    const id = active?.id || uid();
    const title = (active?.title && active.messages.length ? active.title : visible).slice(0, 52);
    const history = [...(active?.messages || []), userMsg];
    const next: Thread = {
      id,
      title: title || "Obrolan baru",
      updatedAt: Date.now(),
      projectId: active?.projectId || projectId || undefined,
      messages: history,
    };
    setThreads((prev) => [next, ...prev.filter((t) => t.id !== id)]);
    setActiveId(id);
    setPanel("home");
    setInput("");
    setPlusOpen(false);
    setLoading(true);
    const image = attachment?.image;
    setAttachment(null);

    try {
      const res = await fetch("/api/henima-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          think,
          mode,
          messages: history.map((m, i) => ({
            role: m.role,
            content: i === history.length - 1 ? content : m.content,
            image: i === history.length - 1 ? image : undefined,
          })),
        }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || "GPT Astra tidak menjawab.";
      setThreads((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, updatedAt: Date.now(), messages: [...t.messages, { role: "assistant", content: reply }] } : t,
        ),
      );
      setNotice({ title: next.title, body: "Respons Anda sudah siap" });
    } catch {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, messages: [...t.messages, { role: "assistant", content: "Koneksi ke GPT Astra putus. Coba kirim lagi." }] }
            : t,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleMic() {
    setMicNote("");
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec; SpeechRecognition?: new () => SpeechRec })
      .SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!Ctor) {
      setMicNote("Mikrofon belum didukung di browser ini.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "id-ID";
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const said = ev.results?.[0]?.[0]?.transcript || "";
      setInput((prev) => (prev ? `${prev} ${said}` : said));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      setMicNote("Mikrofon tidak bisa dipakai. Cek izin browser.");
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  function saveAnswer(body: string) {
    const title = body.replace(/\s+/g, " ").trim().slice(0, 64) || "Catatan";
    setLibrary((prev) => [{ id: uid(), title, body, at: Date.now() }, ...prev]);
    setNotice({ title, body: "Disimpan ke pustaka" });
  }

  const modeMeta = MODES.find((m) => m.id === mode) || null;
  const placeholder = modeMeta?.placeholder || "Tanya Henima AI";

  const plusItems: { key: string; icon: typeof Paperclip; title: string; hint: string; run: () => void }[] = [
    { key: "file", icon: Paperclip, title: "Tambahkan foto & file", hint: "Unggah dari komputer", run: () => fileRef.current?.click() },
    { key: "lib", icon: BookOpen, title: "Tambahkan dari pustaka", hint: "Telusuri file Anda", run: () => setPanel("pustaka") },
    { key: "image", icon: ImageIcon, title: "Buat gambar", hint: "Visualisasikan apa saja", run: () => setMode("image") },
    { key: "web", icon: Globe, title: "Pencarian web", hint: "Temukan berita dan info", run: () => setMode("web") },
    { key: "research", icon: Telescope, title: "Riset mendalam", hint: "Dapatkan laporan terperinci", run: () => setMode("research") },
    { key: "sketch", icon: Shapes, title: "Sketsa", hint: "Gambar dan lampirkan gambar", run: () => setMode("sketch") },
    { key: "think", icon: Lightbulb, title: "Pikirkan", hint: "Untuk jawaban mendetail", run: () => setThink((v) => !v) },
    { key: "template", icon: Sparkles, title: "Template Creator", hint: "Kerangka yang bisa dipakai ulang", run: () => setMode("template") },
    { key: "slides", icon: Presentation, title: "Presentations", hint: "Susun dan sunting presentasi", run: () => setMode("slides") },
    { key: "pdf", icon: FileText, title: "PDF", hint: "Baca, susun, dan cek dokumen", run: () => setMode("pdf") },
  ];

  const composer = (
    <div className="relative mx-auto w-full max-w-[720px]">
      {plusOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-[calc(100%+10px)] left-0 z-20 max-h-[min(440px,52vh)] w-[min(440px,100%)] overflow-y-auto rounded-2xl border border-black/[0.06] bg-white py-1.5 shadow-[0_16px_50px_rgba(0,0,0,0.12)]"
        >
          {plusItems.map((item, i) => (
            <button
              key={item.key}
              type="button"
              onMouseEnter={() => setHighlight(i)}
              onClick={() => {
                item.run();
                setPlusOpen(false);
                boxRef.current?.focus();
              }}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${highlight === i ? "bg-[#F3F3F3]" : ""}`}
            >
              <item.icon size={16} strokeWidth={1.75} className={item.key === "pdf" ? "text-[#E11D2E]" : "text-[#2a2a2a]"} />
              <span className="text-[13.5px] font-medium text-[#171717]">{item.title}</span>
              <span className="ml-auto pl-3 text-[12px] text-[#8d8d8d]">{item.hint}</span>
            </button>
          ))}
        </div>
      )}

      {(modeMeta || think || attachment) && (
        <div className="mb-2 flex flex-wrap items-center gap-2 px-2">
          {modeMeta && (
            <button type="button" onClick={() => setMode(null)} className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F3F3] px-3 py-1 text-[12px] text-[#333]">
              {modeMeta.label}
              <X size={12} />
            </button>
          )}
          {think && (
            <button type="button" onClick={() => setThink(false)} className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F3F3] px-3 py-1 text-[12px] text-[#333]">
              Berpikir
              <X size={12} />
            </button>
          )}
          {attachment && (
            <button type="button" onClick={() => setAttachment(null)} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#F3F3F3] px-3 py-1 text-[12px] text-[#333]">
              <span className="truncate">{attachment.name}</span>
              <X size={12} />
            </button>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex min-h-[56px] items-end gap-1 rounded-full border border-black/[0.08] bg-white px-1.5 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.05)]"
      >
        <button
          type="button"
          aria-label="Tambah"
          onClick={(e) => {
            e.stopPropagation();
            setHighlight(0);
            setPlusOpen((v) => !v);
          }}
          className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#2a2a2a] hover:bg-[#F3F3F3]"
        >
          <Plus size={18} />
        </button>
        <textarea
          ref={boxRef}
          rows={1}
          value={input}
          placeholder={placeholder}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
            if (e.key === "Escape") setPlusOpen(false);
          }}
          className="max-h-[140px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[16px] leading-6 text-[#111] outline-none placeholder:text-[#9a9a9a]"
        />
        <button
          type="button"
          onClick={() => setThink((v) => !v)}
          className={`mb-0.5 hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] sm:inline-flex ${think ? "bg-[#EFEFEF] text-[#111]" : "text-[#5c5c5c] hover:bg-[#F4F4F4]"}`}
        >
          <ThinkIcon />
          Berpikir
        </button>
        <button
          type="button"
          aria-label="Mikrofon"
          onClick={toggleMic}
          className={`mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${listening ? "bg-[#F3F3F3] text-[#111]" : "text-[#3a3a3a] hover:bg-[#F3F3F3]"}`}
        >
          <Mic size={18} />
        </button>
        <button
          type="submit"
          aria-label={input.trim() || attachment ? "Kirim" : "Suara"}
          disabled={loading}
          onClick={(e) => {
            if (!input.trim() && !attachment) {
              e.preventDefault();
              toggleMic();
            }
          }}
          className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3B82F6] text-white disabled:opacity-60"
        >
          {input.trim() || attachment ? <ArrowUp size={18} /> : <AudioLines size={16} />}
        </button>
      </form>
      {micNote && <p className="mt-2 px-3 text-[12px] text-[#8a8a8a]">{micNote}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.txt,.csv,.md,.json,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void onFile(file);
        }}
      />
    </div>
  );

  return (
    <div className="henima-paper flex h-dvh bg-white text-[#111] antialiased" style={{ colorScheme: "light" }}>
      <style>{`.henima-paper *::-webkit-scrollbar-thumb{background:rgba(0,0,0,.18)}`}</style>
      {mobileNav && (
        <button aria-label="Tutup menu" className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={() => setMobileNav(false)} />
      )}

      <aside
        className={[
          "z-40 flex h-full shrink-0 flex-col border-r border-black/[0.06] bg-white",
          mobileNav ? "fixed inset-y-0 left-0 w-[280px]" : "hidden md:flex",
          rail ? "md:w-[72px]" : "md:w-[268px]",
        ].join(" ")}
      >
        <div className={`flex items-center gap-2 px-3 py-3 ${rail ? "justify-center" : ""}`}>
          {rail ? (
            <button type="button" aria-label="Lebarkan menu" onClick={() => setCollapsed(false)}>
              <Mark />
            </button>
          ) : (
            <>
              <Mark />
              <span className="text-[15px] font-semibold tracking-tight">Henima AI</span>
              <div className="ml-auto flex items-center gap-0.5">
                <button type="button" aria-label="Cari" onClick={() => setSearchOpen((v) => !v)} className="rounded-lg p-1.5 text-[#444] hover:bg-[#F3F3F3]">
                  <Search size={16} />
                </button>
                <button type="button" aria-label="Ciutkan" onClick={() => setCollapsed(true)} className="hidden rounded-lg p-1.5 text-[#444] hover:bg-[#F3F3F3] md:inline-flex">
                  <PanelLeft size={16} />
                </button>
              </div>
            </>
          )}
        </div>

        {searchOpen && !rail && (
          <div className="px-3 pb-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari obrolan"
              className="w-full rounded-xl bg-[#F4F4F4] px-3 py-2 text-[13px] outline-none placeholder:text-[#9a9a9a]"
            />
          </div>
        )}

        <nav className="flex flex-col gap-0.5 px-2">
          <SideItem icon={SquarePen} label="Obrolan baru" collapsed={rail} active={isEmptyHome} onClick={openHome} />
          <SideItem icon={Clock} label="Terjadwal" collapsed={rail} active={panel === "terjadwal"} onClick={() => { setPanel("terjadwal"); setMobileNav(false); }} />
          <SideItem icon={Library} label="Pustaka" collapsed={rail} active={panel === "pustaka"} onClick={() => { setPanel("pustaka"); setMobileNav(false); }} />
          <SideItem icon={Puzzle} label="Plugin" collapsed={rail} active={panel === "plugin"} onClick={() => { setPanel("plugin"); setMobileNav(false); }} />
          <SideItem icon={Sparkles} label="Astra" collapsed={rail} active={panel === "astra"} onClick={() => { setPanel("astra"); setMobileNav(false); }} />
          <SideItem icon={Compass} label="Jelajahi" collapsed={rail} active={panel === "jelajah"} onClick={() => { setPanel("jelajah"); setMobileNav(false); }} />
        </nav>

        {!rail && (
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            <p className="px-2.5 pb-1 text-[12px] text-[#8d8d8d]">Proyek</p>
            {PROJECTS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProjectId((cur) => (cur === p.id ? null : p.id));
                  setPanel("home");
                  setActiveId(null);
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[14px] hover:bg-[#F4F4F4] ${projectId === p.id ? "bg-[#F3F3F3]" : ""}`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-md text-white" style={{ background: p.color }}>
                  <Pencil size={11} />
                </span>
                {p.name}
              </button>
            ))}

            <p className="mt-4 px-2.5 pb-1 text-[12px] text-[#8d8d8d]">Terbaru</p>
            {visibleThreads.length === 0 && <p className="px-2.5 py-2 text-[13px] text-[#9a9a9a]">Belum ada obrolan.</p>}
            {visibleThreads.map((t) => (
              <div key={t.id} className={`group flex items-center rounded-xl ${activeId === t.id ? "bg-[#F3F3F3]" : "hover:bg-[#F4F4F4]"}`}>
                <button type="button" onClick={() => openThread(t.id)} className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-[14px]">
                  {t.title}
                </button>
                <button
                  type="button"
                  aria-label="Hapus obrolan"
                  onClick={() => {
                    setThreads((prev) => prev.filter((row) => row.id !== t.id));
                    if (activeId === t.id) setActiveId(null);
                  }}
                  className="mr-1 hidden rounded-md p-1 text-[#888] group-hover:inline-flex"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        {rail && <div className="flex-1" />}

        <div className="relative border-t border-black/[0.04] p-2">
          {userMenu && !rail && (
            <div className="absolute bottom-14 left-2 right-2 rounded-xl border border-black/[0.06] bg-white p-1 shadow-[0_12px_40px_rgba(0,0,0,0.1)]">
              <Link href="/dashboard/owner" className="block rounded-lg px-3 py-2 text-[13px] hover:bg-[#F4F4F4]">
                Kembali ke Gercep OS
              </Link>
            </div>
          )}
          <button
            type="button"
            onClick={() => setUserMenu((v) => !v)}
            className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-[#F4F4F4] ${rail ? "justify-center" : ""}`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5C451] text-[13px] font-semibold text-[#3a2a00]">
              {userName.slice(0, 1).toUpperCase()}
            </span>
            {!rail && (
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{userName}</span>
                <span className="block text-[11px] text-[#8d8d8d]">GPT Astra</span>
              </span>
            )}
          </button>
        </div>
      </aside>

      <section
        className="relative flex min-w-0 flex-1 flex-col bg-white"
        onClick={() => {
          setPlusOpen(false);
          setUserMenu(false);
        }}
      >
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-center">
          <button type="button" aria-label="Menu" onClick={() => setMobileNav(true)} className="pointer-events-auto absolute left-3 rounded-lg p-2 hover:bg-[#F4F4F4] md:hidden">
            <Menu size={18} />
          </button>
          <div className="pointer-events-auto inline-flex items-center rounded-full bg-[#F4F4F4] p-1">
            <button
              type="button"
              onClick={() => {
                setPanel("home");
                setPlusOpen(false);
              }}
              className={`rounded-full px-4 py-1.5 text-[14px] ${panel !== "work" ? "bg-white font-medium shadow-sm" : "text-[#666]"}`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => { setPanel("work"); setActiveId(null); }}
              className={`rounded-full px-4 py-1.5 text-[14px] ${panel === "work" ? "bg-white font-medium shadow-sm" : "text-[#666]"}`}
            >
              + Work
            </button>
          </div>
        </header>

        {notice && (
          <div className="absolute right-4 top-16 z-20 flex w-[280px] items-start gap-3 rounded-2xl border border-black/[0.06] bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F4F4F4]">
              <Sparkles size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{notice.title}</span>
              <span className="block text-[12px] text-[#8d8d8d]">{notice.body}</span>
            </span>
            <button type="button" aria-label="Tutup" onClick={() => setNotice(null)} className="text-[#888]">
              <X size={14} />
            </button>
          </div>
        )}

        {isEmptyHome && (
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-10">
            <h1 className="mb-7 text-center text-[30px] font-medium tracking-[-0.03em] text-[#111] md:text-[34px]">
              Hai, {userName}. Siap mulai?
            </h1>
            {composer}
            <div className="mt-5 w-full max-w-[720px] space-y-1 px-2">
              {QUICK.map((item) => (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => {
                    setMode(item.mode);
                    boxRef.current?.focus();
                  }}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 text-[14.5px] text-[#4a4a4a] hover:bg-[#F6F6F6]"
                >
                  <item.icon size={16} strokeWidth={1.75} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {panel === "home" && active && (
          <>
            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-16">
              <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
                {active.messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="ml-auto max-w-[85%] rounded-3xl bg-[#F4F4F4] px-4 py-2.5 text-[15px] leading-6">
                      {m.content}
                    </div>
                  ) : (
                    <div key={i} className="text-[15.5px] leading-7 text-[#1a1a1a]">
                      {renderAnswer(m.content)}
                      <button type="button" onClick={() => saveAnswer(m.content)} className="mt-2 text-[12px] text-[#8a8a8a] hover:text-[#111]">
                        Simpan ke pustaka
                      </button>
                    </div>
                  ),
                )}
                {loading && <p className="text-[14px] text-[#8a8a8a]">Henima lagi menyusun...</p>}
                <div ref={bottomRef} />
              </div>
            </div>
            <div className="px-4 pb-5">{composer}</div>
          </>
        )}

        {panel === "work" && (
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-16">
            <h1 className="mb-6 text-[28px] font-medium tracking-[-0.03em]">Work</h1>
            <div className="mb-6 grid w-full max-w-[720px] gap-2 sm:grid-cols-2">
              {WORK.map((job) => (
                <button
                  key={job.title}
                  type="button"
                  onClick={() => void send(job.prompt)}
                  className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4 text-left text-[14px] shadow-[0_1px_0_rgba(0,0,0,0.02)] hover:bg-[#FAFAFA]"
                >
                  {job.title}
                </button>
              ))}
            </div>
            {composer}
          </div>
        )}

        {panel === "terjadwal" && (
          <PanelShell title="Terjadwal" subtitle="Pengingat analisa yang kamu simpan di modul ini.">
            <form
              className="mb-4 grid gap-2 rounded-2xl border border-black/[0.06] p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!scheduleDraft.title.trim()) return;
                setSchedules((prev) => [{ id: uid(), title: scheduleDraft.title.trim(), when: scheduleDraft.when.trim(), note: scheduleDraft.note.trim() }, ...prev]);
                setScheduleDraft({ title: "", when: "", note: "" });
              }}
            >
              <input value={scheduleDraft.title} onChange={(e) => setScheduleDraft({ ...scheduleDraft, title: e.target.value })} placeholder="Judul, misalnya Analisa Senin" className="rounded-xl bg-[#F6F6F6] px-3 py-2 text-[14px] outline-none" />
              <input value={scheduleDraft.when} onChange={(e) => setScheduleDraft({ ...scheduleDraft, when: e.target.value })} placeholder="Kapan, misalnya Setiap Senin 08.00" className="rounded-xl bg-[#F6F6F6] px-3 py-2 text-[14px] outline-none" />
              <input value={scheduleDraft.note} onChange={(e) => setScheduleDraft({ ...scheduleDraft, note: e.target.value })} placeholder="Catatan" className="rounded-xl bg-[#F6F6F6] px-3 py-2 text-[14px] outline-none" />
              <button type="submit" className="w-fit rounded-full bg-[#111] px-4 py-2 text-[13px] text-white">Simpan</button>
            </form>
            {schedules.length === 0 && <Empty>Belum ada jadwal.</Empty>}
            {schedules.map((s) => (
              <Row key={s.id} title={s.title} meta={s.when || "Tanpa waktu"} body={s.note} onDelete={() => setSchedules((prev) => prev.filter((row) => row.id !== s.id))} />
            ))}
          </PanelShell>
        )}

        {panel === "pustaka" && (
          <PanelShell title="Pustaka" subtitle="Jawaban yang kamu simpan dari obrolan.">
            {library.length === 0 && <Empty>Pustaka masih kosong. Simpan jawaban dari chat.</Empty>}
            {library.map((item) => (
              <Row
                key={item.id}
                title={item.title}
                meta={new Date(item.at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                body={item.body}
                onDelete={() => setLibrary((prev) => prev.filter((row) => row.id !== item.id))}
                onUse={() => {
                  setInput(item.body.slice(0, 500));
                  openHome();
                }}
              />
            ))}
          </PanelShell>
        )}

        {panel === "plugin" && (
          <PanelShell title="Plugin" subtitle="Mode yang menempel di pertanyaan berikutnya.">
            <div className="grid gap-2 sm:grid-cols-2">
              {MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMode(item.id);
                    openHome();
                  }}
                  className="rounded-2xl border border-black/[0.06] px-4 py-3 text-left hover:bg-[#FAFAFA]"
                >
                  <span className="block text-[14px] font-medium">{item.label}</span>
                  <span className="block text-[12px] text-[#8a8a8a]">{item.hint}</span>
                </button>
              ))}
            </div>
          </PanelShell>
        )}

        {panel === "astra" && (
          <PanelShell title="GPT Astra" subtitle="Mesin analisa Henima AI. Angka diambil dari data Gercep bisnis yang sedang aktif.">
            <div className="grid gap-2">
              {WORK.slice(0, 4).map((job) => (
                <button key={job.title} type="button" onClick={() => void send(job.prompt)} className="rounded-2xl bg-[#F6F6F6] px-4 py-3 text-left text-[14px] hover:bg-[#F1F1F1]">
                  {job.title}
                </button>
              ))}
            </div>
          </PanelShell>
        )}

        {panel === "jelajah" && (
          <PanelShell title="Jelajahi" subtitle="Pertanyaan yang sering dipakai untuk analisa.">
            <div className="grid gap-2">
              {EXPLORE.map((prompt) => (
                <button key={prompt} type="button" onClick={() => void send(prompt)} className="rounded-2xl border border-black/[0.06] px-4 py-3 text-left text-[14px] hover:bg-[#FAFAFA]">
                  {prompt}
                </button>
              ))}
            </div>
          </PanelShell>
        )}
      </section>
    </div>
  );
}

function SideItem({
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  icon: typeof SquarePen;
  label: string;
  active?: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[14px] ${collapsed ? "justify-center" : ""} ${active ? "bg-[#F0F0F0]" : "hover:bg-[#F4F4F4]"}`}
    >
      <Icon size={17} strokeWidth={1.75} className="shrink-0 text-[#2c2c2c]" />
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

function PanelShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto px-5 pb-10 pt-20">
      <div className="mx-auto w-full max-w-[720px]">
        <h1 className="text-[28px] font-medium tracking-[-0.03em]">{title}</h1>
        <p className="mb-5 mt-1 text-[14px] text-[#777]">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-[#F7F7F7] px-4 py-6 text-[14px] text-[#777]">{children}</p>;
}

function Row({
  title,
  meta,
  body,
  onDelete,
  onUse,
}: {
  title: string;
  meta: string;
  body?: string;
  onDelete: () => void;
  onUse?: () => void;
}) {
  return (
    <div className="mb-2 rounded-2xl border border-black/[0.06] px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">{title}</p>
          <p className="text-[12px] text-[#8a8a8a]">{meta}</p>
          {body ? <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[13px] leading-5 text-[#333]">{body}</p> : null}
        </div>
        <div className="flex shrink-0 gap-2">
          {onUse && (
            <button type="button" onClick={onUse} className="text-[12px] text-[#444] hover:text-[#111]">
              Pakai
            </button>
          )}
          <button type="button" onClick={onDelete} className="text-[12px] text-[#999] hover:text-[#111]">
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  onresult: ((ev: { results?: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function shrinkImage(file: File): Promise<{ mediaType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      URL.revokeObjectURL(url);
      resolve({ mediaType: "image/jpeg", data: dataUrl.split(",")[1] || "" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}
