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
  brandSubtitle: "Business Master Mentor",
  signedInAs: (name) => `Masuk sebagai ${name}`,
  backToGercep: "Kembali ke Gercep OS",
  openMenu: "Buka menu",
  closeMenu: "Tutup menu",
  nav: {
    overview: "Ringkasan",
    chat: "Mentor Chat",
    portfolio: "Portofolio Bisnis",
    memory: "Memori",
    "memory-owner": "Profil Owner",
    "memory-business": "Pengetahuan Bisnis",
    "memory-financial": "Catatan Keuangan",
    "memory-decisions": "Riwayat Keputusan",
    "memory-strategy": "Rencana Strategis",
    "memory-learning": "Riwayat Pembelajaran",
    "memory-candidates": "Menunggu Persetujuan",
    strategy: "Ruang Strategi",
    financial: "Intelijen Keuangan",
    journal: "Jurnal Keputusan",
    autonomy: "Autonomous Assistant",
    "auto-planner": "Task Planner",
    "auto-monitor": "Execution Monitor",
    "auto-permissions": "Permission Settings",
    "auto-tools": "Tool Registry",
    approvals: "Approval Center",
    executions: "Riwayat Eksekusi",
    automation: "Otomasi",
    settings: "Pengaturan AI",
  },
  overview: {
    title: "Business Master Mentor",
    tagline: "Intelijen bisnis personal Anda.",
    welcome: (name) => `Selamat datang, ${name}`,
    welcomeBodyEmpty:
      "Meja owner untuk mentoring strategis di portofolio HENIMA AI. Tambahkan bisnis pertama di Portofolio Bisnis — HENIMA Perfume bisa didaftarkan sebagai bisnis #1.",
    welcomeBodyFilled: (count, active) =>
      `Meja owner untuk mentoring strategis di portofolio HENIMA AI. ${count} bisnis di portofolio${active ? ` (${active} aktif)` : ""}.`,
    banner:
      "Phase 3 Master Orchestrator aktif di Mentor Chat. Panel di bawah hanya memakai data yang Anda masukkan — tidak ada angka fiktif.",
    briefingTitle: "Briefing Bisnis",
    briefingSubtitle: "Ringkasan konteks portofolio",
    openPortfolio: "Buka portofolio",
    portfolioNotReady: "Penyimpanan portofolio belum siap",
    noBriefing: "Belum ada briefing",
    noBriefingDesc:
      "Belum ada bisnis di portofolio. Tambahkan bisnis dulu — misalnya HENIMA Perfume — lalu panel ini akan memakai konteks itu.",
    goPortfolio: "Ke Portofolio Bisnis",
    prioritiesTitle: "Prioritas Strategis",
    prioritiesSubtitle: "Fokus yang Anda tetapkan",
    openStrategy: "Buka memori strategis",
    noPriorities: "Belum ada prioritas",
    noPrioritiesDesc:
      "Tambahkan rencana di Memori → Rencana Strategis. Tidak ada prioritas placeholder yang ditampilkan.",
    healthTitle: "Kesehatan Bisnis",
    healthSubtitle: "Sinyal dari data terhubung",
    healthEmpty: "Sinyal kesehatan belum tersedia",
    healthEmptyDesc:
      "Kesehatan bisnis membutuhkan data keuangan/operasional yang terhubung. Skor tidak dibuat-buat.",
    decisionsTitle: "Keputusan Terbaru",
    decisionsSubtitle: "Dari Riwayat Keputusan",
    openDecisions: "Buka keputusan",
    noDecisions: "Belum ada keputusan",
    noDecisionsDesc:
      "Saat Anda mencatat keputusan di Memori → Riwayat Keputusan, entri terbaru akan muncul di sini.",
    recsTitle: "Rekomendasi Mentor",
    recsSubtitle: "Output Orchestrator",
    openChat: "Buka Mentor Chat",
    recsEmpty: "Belum ada rekomendasi di sini",
    recsEmptyDesc:
      "Jalankan konsultasi di Mentor Chat. Rekomendasi muncul setelah analisis nyata, bukan dari contoh fiktif.",
    nextTitle: "Langkah berikutnya",
    nextSubtitle: "Roadmap modul",
    nextBody:
      "Lengkapi Portofolio Bisnis dan isi Business Memory, lalu gunakan Mentor Chat untuk analisis. Ruang Strategi, Intelijen Keuangan, dan Jurnal Keputusan memakai data memori yang sama.",
  },
  chat: {
    title: "Mentor Chat",
    deskFor: (name) => `Meja konsultasi untuk ${name}`,
    newConversation: "Percakapan baru",
    banner:
      "Phase 3 Master Orchestrator aktif. Spesialis hanya ditampilkan jika benar-benar dijalankan. Angka hanya dari Business Memory — tidak dikarang.",
    history: "Riwayat chat",
    searchPlaceholder: "Cari percakapan…",
    noConversations: "Belum ada percakapan.",
    businessContext: "Konteks bisnis",
    noPortfolio: "Belum ada bisnis di portofolio",
    specialists: "Spesialis",
    idle: "Siaga",
    running: "berjalan",
    done: "selesai",
    startTitle: "Mulai konsultasi",
    startBody: (context) =>
      `Konteks: ${context}. Master Orchestrator akan mengambil Business Memory dan memanggil spesialis yang diperlukan saja.`,
    sources: "Sumber",
    missing: "Kurang",
    placeholder: "Tulis pertanyaan bisnis untuk Master Mentor…",
    send: "Kirim",
    preparing: "Menyiapkan Master Orchestrator…",
    failLoadConversations: "Gagal memuat percakapan",
    failLoadMessages: "Gagal memuat pesan",
    failRespond: "Master Mentor gagal merespons. Coba lagi atau periksa konfigurasi provider.",
  },
  settings: {
    title: "Pengaturan AI",
    subtitle: "Preferensi modul Business Master Mentor.",
    banner:
      "Kunci API tetap di server dan tidak bisa diubah dari UI ini. Bahasa antarmuka bisa diganti di bawah.",
    accessTitle: "Akses",
    accessSubtitle: "Hanya owner",
    signedInOwner: "Owner yang masuk",
    email: "Email",
    gercepOwned: "Bisnis Gercep yang dimiliki",
    engineTitle: "Status mesin",
    engineSubtitle: "Intelijen Phase 3",
    orchestrator: "Master Orchestrator",
    orchestratorValue: "Aktif (hanya analisis)",
    specialists: "Spesialis",
    specialistsValue: "Chairman · Strategy · CFO · Growth · Operations · Risk",
    permissions: "Izin",
    permissionsValue: "BACA + ANALISIS (tanpa TULIS)",
    apiSecrets: "Rahasia API",
    apiSecretsValue: "Hanya di server · tidak pernah di klien",
    languageTitle: "Bahasa",
    languageSubtitle: "Antarmuka & jawaban mentor",
    languageHint:
      "Pilihan ini mengatur label UI dan bahasa jawaban Master Mentor. Disimpan di perangkat Anda.",
    languageId: "Bahasa Indonesia",
    languageEn: "English",
    saved: "Tersimpan",
    emptyTitle: "Preferensi lain belum bisa diubah",
    emptyDesc: "Tone, routing spesialis, dan preferensi model akan bisa dikonfigurasi nanti.",
  },
};

const en: MentorDictionary = {
  brandSubtitle: "Business Master Mentor",
  signedInAs: (name) => `Signed in as ${name}`,
  backToGercep: "Back to Gercep OS",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  nav: {
    overview: "Overview",
    chat: "Mentor Chat",
    portfolio: "Business Portfolio",
    memory: "Memory",
    "memory-owner": "Owner Profile",
    "memory-business": "Business Knowledge",
    "memory-financial": "Financial Records",
    "memory-decisions": "Decision History",
    "memory-strategy": "Strategic Plans",
    "memory-learning": "Learning History",
    "memory-candidates": "Pending Approvals",
    strategy: "Strategy Room",
    financial: "Financial Intelligence",
    journal: "Decision Journal",
    autonomy: "Autonomous Assistant",
    "auto-planner": "Task Planner",
    "auto-monitor": "Execution Monitor",
    "auto-permissions": "Permission Settings",
    "auto-tools": "Tool Registry",
    approvals: "Approval Center",
    executions: "Execution History",
    automation: "Automation",
    settings: "AI Settings",
  },
  overview: {
    title: "Business Master Mentor",
    tagline: "Your Personal Business Intelligence.",
    welcome: (name) => `Welcome, ${name}`,
    welcomeBodyEmpty:
      "Owner desk for strategic mentoring across your HENIMA AI portfolio. Add your first business in Business Portfolio when ready — HENIMA Perfume can be registered as business #1.",
    welcomeBodyFilled: (count, active) =>
      `Owner desk for strategic mentoring across your HENIMA AI portfolio. ${count} portfolio business${count === 1 ? "" : "es"} on file${active ? ` (${active} active)` : ""}.`,
    banner:
      "Phase 3 Master Orchestrator is live in Mentor Chat. Panels below use owner-entered data only — nothing is simulated.",
    briefingTitle: "Business Briefing",
    briefingSubtitle: "Summary of portfolio context",
    openPortfolio: "Open portfolio",
    portfolioNotReady: "Portfolio storage not ready",
    noBriefing: "No briefing yet",
    noBriefingDesc:
      "There is no portfolio business to brief. Add a business first — for example HENIMA Perfume — then this panel will use that context.",
    goPortfolio: "Go to Business Portfolio",
    prioritiesTitle: "Strategic Priorities",
    prioritiesSubtitle: "Owner-defined focus areas",
    openStrategy: "Open strategic memory",
    noPriorities: "No priorities recorded",
    noPrioritiesDesc:
      "Add strategic plans in Memory → Strategic Plans. No placeholder priorities are shown.",
    healthTitle: "Business Health",
    healthSubtitle: "Signals from connected data",
    healthEmpty: "Health signals unavailable",
    healthEmptyDesc:
      "Business health requires connected financial and operational data. No scores are fabricated.",
    decisionsTitle: "Recent Decisions",
    decisionsSubtitle: "From Decision History",
    openDecisions: "Open decisions",
    noDecisions: "No decisions logged",
    noDecisionsDesc:
      "When you record decisions in Memory → Decision History, the latest entries will show here.",
    recsTitle: "Mentor Recommendations",
    recsSubtitle: "Orchestrator output",
    openChat: "Open Mentor Chat",
    recsEmpty: "No recommendations here yet",
    recsEmptyDesc:
      "Run a consultation in Mentor Chat. Recommendations appear only after real analysis — nothing is fabricated.",
    nextTitle: "Next step",
    nextSubtitle: "Module roadmap",
    nextBody:
      "Complete Business Portfolio and Business Memory, then use Mentor Chat for analysis. Strategy Room, Financial Intelligence, and Decision Journal share the same memory data.",
  },
  chat: {
    title: "Mentor Chat",
    deskFor: (name) => `Consultation desk for ${name}`,
    newConversation: "New conversation",
    banner:
      "Phase 3 Master Orchestrator is active. Specialists appear only when they actually ran. Numbers come only from Business Memory — nothing invented.",
    history: "Chat history",
    searchPlaceholder: "Search conversations…",
    noConversations: "No conversations yet.",
    businessContext: "Business context",
    noPortfolio: "No portfolio business",
    specialists: "Specialists",
    idle: "Idle",
    running: "running",
    done: "done",
    startTitle: "Start a consultation",
    startBody: (context) =>
      `Context: ${context}. Master Orchestrator will retrieve Business Memory and call only the specialists needed.`,
    sources: "Sources",
    missing: "Missing",
    placeholder: "Write a prompt for your business mentor…",
    send: "Send",
    preparing: "Preparing Master Orchestrator…",
    failLoadConversations: "Failed to load conversations",
    failLoadMessages: "Failed to load messages",
    failRespond: "Master Mentor failed to respond. Try again or check provider configuration.",
  },
  settings: {
    title: "AI Settings",
    subtitle: "Preferences for the Business Master Mentor module.",
    banner:
      "API keys stay on the server and are not editable from this UI. Interface language can be changed below.",
    accessTitle: "Access",
    accessSubtitle: "Owner-only gate",
    signedInOwner: "Signed-in owner",
    email: "Email",
    gercepOwned: "Gercep businesses owned",
    engineTitle: "Engine status",
    engineSubtitle: "Phase 3 intelligence",
    orchestrator: "Master Orchestrator",
    orchestratorValue: "Active (analyze-only)",
    specialists: "Specialists",
    specialistsValue: "Chairman · Strategy · CFO · Growth · Operations · Risk",
    permissions: "Permissions",
    permissionsValue: "READ + ANALYZE (no WRITE)",
    apiSecrets: "API secrets",
    apiSecretsValue: "Server-only · never in client",
    languageTitle: "Language",
    languageSubtitle: "Interface & mentor replies",
    languageHint:
      "This controls UI labels and the language Master Mentor answers in. Saved on this device.",
    languageId: "Bahasa Indonesia",
    languageEn: "English",
    saved: "Saved",
    emptyTitle: "No other editable AI preferences yet",
    emptyDesc: "Tone, specialist routing, and model preferences will be configurable later.",
  },
};

const DICTS: Record<MentorLocale, MentorDictionary> = { id, en };

export function getMentorDictionary(locale: MentorLocale): MentorDictionary {
  return DICTS[locale] || DICTS.id;
}
