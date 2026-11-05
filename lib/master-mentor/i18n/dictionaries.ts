import type { MentorLocale } from "./types";

export type MentorDictionary = {
  brandSubtitle: string;
  signedInAs: (name: string) => string;
  backToGercep: string;
  openMenu: string;
  closeMenu: string;
  nav: Record<string, string>;
  overview: {
    title: string;
    tagline: string;
    welcome: (name: string) => string;
    welcomeBodyEmpty: string;
    welcomeBodyFilled: (count: number, active: number) => string;
    banner: string;
    briefingTitle: string;
    briefingSubtitle: string;
    openPortfolio: string;
    portfolioNotReady: string;
    noBriefing: string;
    noBriefingDesc: string;
    goPortfolio: string;
    prioritiesTitle: string;
    prioritiesSubtitle: string;
    openStrategy: string;
    noPriorities: string;
    noPrioritiesDesc: string;
    healthTitle: string;
    healthSubtitle: string;
    healthEmpty: string;
    healthEmptyDesc: string;
    decisionsTitle: string;
    decisionsSubtitle: string;
    openDecisions: string;
    noDecisions: string;
    noDecisionsDesc: string;
    recsTitle: string;
    recsSubtitle: string;
    openChat: string;
    recsEmpty: string;
    recsEmptyDesc: string;
    nextTitle: string;
    nextSubtitle: string;
    nextBody: string;
  };
  chat: {
    title: string;
    deskFor: (name: string) => string;
    newConversation: string;
    banner: string;
    history: string;
    searchPlaceholder: string;
    noConversations: string;
    businessContext: string;
    noPortfolio: string;
    specialists: string;
    idle: string;
    running: string;
    done: string;
    startTitle: string;
    startBody: (context: string) => string;
    sources: string;
    missing: string;
    placeholder: string;
    send: string;
    preparing: string;
    failLoadConversations: string;
    failLoadMessages: string;
    failRespond: string;
  };
  settings: {
    title: string;
    subtitle: string;
    banner: string;
    accessTitle: string;
    accessSubtitle: string;
    signedInOwner: string;
    email: string;
    gercepOwned: string;
    engineTitle: string;
    engineSubtitle: string;
    orchestrator: string;
    orchestratorValue: string;
    specialists: string;
    specialistsValue: string;
    permissions: string;
    permissionsValue: string;
    apiSecrets: string;
    apiSecretsValue: string;
    languageTitle: string;
    languageSubtitle: string;
    languageHint: string;
    languageId: string;
    languageEn: string;
    saved: string;
    emptyTitle: string;
    emptyDesc: string;
  };
};

const id: MentorDictionary = {
  brandSubtitle: "Mentor Bisnis",
  signedInAs: (name) => `Halo, ${name}`,
  backToGercep: "Kembali ke Gercep",
  openMenu: "Buka menu",
  closeMenu: "Tutup menu",
  nav: {
    overview: "Beranda",
    chat: "Chat Mentor",
    portfolio: "Bisnis Saya",
    memory: "Memori",
    "memory-owner": "Profil kamu",
    "memory-business": "Info bisnis",
    "memory-financial": "Catatan uang",
    "memory-decisions": "Keputusan",
    "memory-strategy": "Rencana",
    "memory-learning": "Pelajaran",
    "memory-candidates": "Menunggu OK",
    strategy: "Rencana",
    financial: "Keuangan",
    intelligence: "Angka bisnis",
    "intel-performance": "Performa",
    "intel-financial": "Keuangan",
    "intel-growth": "Pertumbuhan",
    "intel-people": "Tim sales",
    "intel-inventory": "Stok",
    "intel-risk": "Risiko",
    "intel-comparison": "Bandingkan",
    "intel-reports": "Laporan",
    journal: "Jurnal keputusan",
    autonomy: "Asisten otomatis",
    "auto-planner": "Rencana tugas",
    "auto-monitor": "Pantau jalan",
    "auto-permissions": "Izin asisten",
    "auto-tools": "Daftar tools",
    approvals: "Persetujuan",
    executions: "Riwayat aksi",
    automation: "Otomasi",
    "auto-workflows": "Alur kerja",
    "auto-schedules": "Jadwal",
    "auto-whatsapp": "WhatsApp",
    "auto-shopee": "Shopee",
    "auto-alerts": "Alert",
    "auto-history": "Riwayat jalan",
    settings: "Pengaturan",
  },
  overview: {
    title: "Mentor Bisnis",
    tagline: "Teman ngobrol soal bisnis — pakai data yang kamu isi.",
    welcome: (name) => `Hai ${name}`,
    welcomeBodyEmpty:
      "Mulai dari Bisnis Saya — daftar HENIMA Perfume, isi catatan uang, lalu chat mentor.",
    welcomeBodyFilled: (count, active) =>
      `${count} bisnis tersimpan${active ? ` (${active} aktif)` : ""}. Chat mentor kalau mau bahas angka atau langkah minggu ini.`,
    banner: "Angka di sini dari data kamu. Mentor tidak mengarang.",
    briefingTitle: "Ringkasan bisnis",
    briefingSubtitle: "Dari portofolio",
    openPortfolio: "Lihat bisnis",
    portfolioNotReady: "Penyimpanan bisnis belum siap",
    noBriefing: "Belum ada bisnis",
    noBriefingDesc: "Tambah bisnis dulu (mis. HENIMA Perfume), baru ringkasan muncul di sini.",
    goPortfolio: "Ke Bisnis Saya",
    prioritiesTitle: "Fokus kamu",
    prioritiesSubtitle: "Dari rencana yang kamu tulis",
    openStrategy: "Buka rencana",
    noPriorities: "Belum ada fokus",
    noPrioritiesDesc: "Isi di Memori → Rencana. Tidak ada contoh palsu.",
    healthTitle: "Kondisi bisnis",
    healthSubtitle: "Dari data yang terhubung",
    healthEmpty: "Belum ada sinyal",
    healthEmptyDesc: "Butuh data keuangan/operasional. Skor tidak dibuat-buat.",
    decisionsTitle: "Keputusan terakhir",
    decisionsSubtitle: "Dari catatan keputusan",
    openDecisions: "Buka keputusan",
    noDecisions: "Belum ada catatan",
    noDecisionsDesc: "Catat keputusan di Memori → Keputusan, nanti muncul di sini.",
    recsTitle: "Saran mentor",
    recsSubtitle: "Dari chat terakhir",
    openChat: "Buka chat",
    recsEmpty: "Belum ada saran",
    recsEmptyDesc: "Chat dulu — saran muncul setelah jawaban nyata, bukan contoh fiktif.",
    nextTitle: "Langkah mudah",
    nextSubtitle: "Mulai dari sini",
    nextBody:
      "1) Isi Bisnis Saya  2) Isi catatan uang  3) Chat mentor. Rencana & keuangan baca data yang sama.",
  },
  chat: {
    title: "Chat Mentor",
    deskFor: (name) => `Chat untuk ${name}`,
    newConversation: "Chat baru",
    banner: "Angka dari memori & yang kamu tulis — tidak dikarang.",
    history: "Riwayat",
    searchPlaceholder: "Cari chat…",
    noConversations: "Belum ada chat.",
    businessContext: "Bisnis",
    noPortfolio: "Belum ada bisnis",
    specialists: "Tim mentor",
    idle: "Siaga",
    running: "jalan",
    done: "selesai",
    startTitle: "Tanya aja soal bisnis",
    startBody: (context) =>
      `Lagi bahas: ${context}. Ketik biasa — jawaban singkat dari data yang ada.`,
    sources: "Sumber",
    missing: "Kurang",
    placeholder: "Tulis pertanyaan…",
    send: "Kirim",
    preparing: "Mentor lagi ngetik…",
    failLoadConversations: "Gagal muat chat",
    failLoadMessages: "Gagal muat pesan",
    failRespond: "Gagal jawab. Coba lagi, atau cek ANTHROPIC_API_KEY di Vercel.",
  },
  settings: {
    title: "Pengaturan",
    subtitle: "Bahasa & status mentor.",
    banner: "Kunci API cuma di server. Bahasa UI & jawaban bisa diganti di bawah.",
    accessTitle: "Akses",
    accessSubtitle: "Owner saja",
    signedInOwner: "Owner yang masuk",
    email: "Email",
    gercepOwned: "Bisnis Gercep milikmu",
    engineTitle: "Status mentor",
    engineSubtitle: "Mode analisis",
    orchestrator: "Mentor utama",
    orchestratorValue: "Aktif (analisis saja)",
    specialists: "Tim",
    specialistsValue: "Ketua · Strategi · CFO · Growth · Operasi · Risiko",
    permissions: "Izin",
    permissionsValue: "Baca + analisis (belum tulis otomatis)",
    apiSecrets: "Kunci API",
    apiSecretsValue: "Server saja · tidak di HP/browser",
    languageTitle: "Bahasa",
    languageSubtitle: "UI & jawaban mentor",
    languageHint: "Atur label layar dan bahasa jawaban. Disimpan di perangkat ini.",
    languageId: "Bahasa Indonesia",
    languageEn: "English",
    saved: "Tersimpan",
    emptyTitle: "Belum banyak yang bisa diubah",
    emptyDesc: "Tone & model nanti bisa diatur di sini.",
  },
};

const en: MentorDictionary = {
  brandSubtitle: "Business Mentor",
  signedInAs: (name) => `Hi, ${name}`,
  backToGercep: "Back to Gercep",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  nav: {
    overview: "Home",
    chat: "Mentor Chat",
    portfolio: "My businesses",
    memory: "Memory",
    "memory-owner": "Your profile",
    "memory-business": "Business info",
    "memory-financial": "Money notes",
    "memory-decisions": "Decisions",
    "memory-strategy": "Plans",
    "memory-learning": "Lessons",
    "memory-candidates": "Needs your OK",
    strategy: "Plans",
    financial: "Finance",
    intelligence: "Business numbers",
    "intel-performance": "Performance",
    "intel-financial": "Finance",
    "intel-growth": "Growth",
    "intel-people": "Sales team",
    "intel-inventory": "Stock",
    "intel-risk": "Risks",
    "intel-comparison": "Compare",
    "intel-reports": "Reports",
    journal: "Decision journal",
    autonomy: "Auto assistant",
    "auto-planner": "Task planner",
    "auto-monitor": "Run monitor",
    "auto-permissions": "Permissions",
    "auto-tools": "Tools",
    approvals: "Approvals",
    executions: "Action history",
    automation: "Automation",
    "auto-workflows": "Workflows",
    "auto-schedules": "Schedules",
    "auto-whatsapp": "WhatsApp",
    "auto-shopee": "Shopee",
    "auto-alerts": "Alerts",
    "auto-history": "Run history",
    settings: "Settings",
  },
  overview: {
    title: "Business Mentor",
    tagline: "A business chat buddy — powered by what you enter.",
    welcome: (name) => `Hi ${name}`,
    welcomeBodyEmpty:
      "Start in My businesses — add HENIMA Perfume, fill money notes, then chat the mentor.",
    welcomeBodyFilled: (count, active) =>
      `${count} business${count === 1 ? "" : "es"} on file${active ? ` (${active} active)` : ""}. Chat when you want to talk numbers or this week’s moves.`,
    banner: "Numbers here come from your data. The mentor doesn’t invent them.",
    briefingTitle: "Business snapshot",
    briefingSubtitle: "From your portfolio",
    openPortfolio: "View businesses",
    portfolioNotReady: "Business storage isn’t ready",
    noBriefing: "No business yet",
    noBriefingDesc: "Add a business first (e.g. HENIMA Perfume), then this summary fills in.",
    goPortfolio: "Go to My businesses",
    prioritiesTitle: "Your focus",
    prioritiesSubtitle: "From plans you wrote",
    openStrategy: "Open plans",
    noPriorities: "No focus yet",
    noPrioritiesDesc: "Add them in Memory → Plans. No fake placeholders.",
    healthTitle: "Business pulse",
    healthSubtitle: "From linked data",
    healthEmpty: "No signals yet",
    healthEmptyDesc: "Needs finance/ops data. Scores aren’t made up.",
    decisionsTitle: "Recent decisions",
    decisionsSubtitle: "From your decision notes",
    openDecisions: "Open decisions",
    noDecisions: "No notes yet",
    noDecisionsDesc: "Log decisions in Memory → Decisions and they’ll show here.",
    recsTitle: "Mentor tips",
    recsSubtitle: "From recent chat",
    openChat: "Open chat",
    recsEmpty: "No tips yet",
    recsEmptyDesc: "Chat first — tips appear after a real answer, not fake samples.",
    nextTitle: "Easy next steps",
    nextSubtitle: "Start here",
    nextBody:
      "1) Add My businesses  2) Fill money notes  3) Chat the mentor. Plans & finance share the same data.",
  },
  chat: {
    title: "Mentor Chat",
    deskFor: (name) => `Chat for ${name}`,
    newConversation: "New chat",
    banner: "Numbers come from memory and what you type — nothing invented.",
    history: "History",
    searchPlaceholder: "Search chats…",
    noConversations: "No chats yet.",
    businessContext: "Business",
    noPortfolio: "No business yet",
    specialists: "Mentor team",
    idle: "Idle",
    running: "running",
    done: "done",
    startTitle: "Ask anything about the business",
    startBody: (context) =>
      `Talking about: ${context}. Just type normally — short answers from the data on file.`,
    sources: "Sources",
    missing: "Missing",
    placeholder: "Type a question…",
    send: "Send",
    preparing: "Mentor is typing…",
    failLoadConversations: "Failed to load chats",
    failLoadMessages: "Failed to load messages",
    failRespond: "Couldn’t reply. Try again, or check ANTHROPIC_API_KEY on Vercel.",
  },
  settings: {
    title: "Settings",
    subtitle: "Language & mentor status.",
    banner: "API keys stay on the server. Change UI & reply language below.",
    accessTitle: "Access",
    accessSubtitle: "Owner only",
    signedInOwner: "Signed-in owner",
    email: "Email",
    gercepOwned: "Gercep businesses you own",
    engineTitle: "Mentor status",
    engineSubtitle: "Analyze mode",
    orchestrator: "Lead mentor",
    orchestratorValue: "On (analyze only)",
    specialists: "Team",
    specialistsValue: "Chair · Strategy · CFO · Growth · Ops · Risk",
    permissions: "Permissions",
    permissionsValue: "Read + analyze (no auto-write yet)",
    apiSecrets: "API keys",
    apiSecretsValue: "Server only · never in the browser",
    languageTitle: "Language",
    languageSubtitle: "UI & mentor replies",
    languageHint: "Controls labels and reply language. Saved on this device.",
    languageId: "Bahasa Indonesia",
    languageEn: "English",
    saved: "Saved",
    emptyTitle: "Not much else to tweak yet",
    emptyDesc: "Tone & model options will land here later.",
  },
};

const DICTS: Record<MentorLocale, MentorDictionary> = { id, en };

export function getMentorDictionary(locale: MentorLocale): MentorDictionary {
  return DICTS[locale] || DICTS.id;
}
