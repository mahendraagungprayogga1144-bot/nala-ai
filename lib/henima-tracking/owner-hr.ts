import "server-only";
import { todayWib } from "@/lib/date";
import type { SalesDb } from "@/lib/henima-sales/db";
import { dayWindow } from "./service";
import { TRACKING_AUTO_CLOSE_HOUR, wibHourNow, wibParts } from "./schedule";

export type FieldStatusLabel = "Live" | "Aktif" | "Sepi" | "Senyap" | "Offline" | "Selesai";

/** Soft warn sebelum Senyap penuh. */
export const SEPI_MS = 10 * 60_000;
export const SENYAP_MS = 20 * 60_000;

export type FieldPerson = {
  id: string;
  nama: string;
  role: string;
  label: FieldStatusLabel;
  lastAt: string | null;
  minutesAgo: number | null;
  checkinPagi: boolean;
  checkinSore: boolean;
  visits: number;
  meaning: string;
};

function minutesAgo(iso: string) {
  return Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

function clockWib(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function meaningFor(label: FieldStatusLabel, minutes: number | null): string {
  switch (label) {
    case "Live":
      return "GPS baru kirim. HP & app masih jalan.";
    case "Aktif":
      return "Masih kirim, jeda singkat wajar di lapangan.";
    case "Sepi":
      return `Mulai sepi ±${minutes || "?"} menit tanpa GPS baru. Pantau — bisa jadi sinyal lemah atau app hampir mati.`;
    case "Senyap":
      return `HP berhenti kirim ±${minutes || "?"} menit. Biasanya app ditutup, clear RAM agresif, Force stop, atau hemat baterai mematikan app. Bukan berarti sales di rumah — berarti sinyal GPS dari app mati.`;
    case "Offline":
      return "Belum ada titik GPS hari ini. Belum buka app / belum absen / link belum dipakai.";
    case "Selesai":
      return "Sudah check-out / sesi lapangan ditutup.";
  }
}

type PointLite = { staff_id: string; kind: string; recorded_at: string };

function statusFor(points: PointLite[]): {
  label: FieldStatusLabel;
  lastAt: string | null;
  checkinPagi: boolean;
  checkinSore: boolean;
  visits: number;
} {
  const checkinPagi = points.some((p) => p.kind === "checkin_pagi");
  const checkinSore = points.some((p) => p.kind === "checkin_sore");
  const visits = points.filter((p) => p.kind === "visit").length;
  const last = points[0] || null;
  if (checkinSore) {
    return { label: "Selesai", lastAt: last?.recorded_at || null, checkinPagi, checkinSore, visits };
  }
  if (!last) {
    return { label: "Offline", lastAt: null, checkinPagi, checkinSore, visits };
  }
  const freshMs = Date.now() - new Date(last.recorded_at).getTime();
  if (freshMs <= 3 * 60_000) {
    return { label: "Live", lastAt: last.recorded_at, checkinPagi, checkinSore, visits };
  }
  if (freshMs <= SEPI_MS) {
    return { label: "Aktif", lastAt: last.recorded_at, checkinPagi, checkinSore, visits };
  }
  if (freshMs <= SENYAP_MS) {
    return { label: "Sepi", lastAt: last.recorded_at, checkinPagi, checkinSore, visits };
  }
  return { label: "Senyap", lastAt: last.recorded_at, checkinPagi, checkinSore, visits };
}

export async function loadHrFieldRoster(db: SalesDb, businessId: string): Promise<FieldPerson[]> {
  const { data: staffRows, error: staffErr } = await db
    .from("module_sales_staff")
    .select("id, nama, role, status")
    .eq("business_id", businessId)
    .eq("status", "active")
    .neq("role", "FOUNDER")
    .order("nama");
  if (staffErr) throw new Error(staffErr.message);
  const staff = (staffRows || []) as { id: string; nama: string; role: string }[];
  if (!staff.length) return [];

  const win = dayWindow();
  const ids = staff.map((s) => s.id);
  const { data: points, error: pointErr } = await db
    .from("module_henima_tracking_points")
    .select("staff_id, kind, recorded_at")
    .eq("business_id", businessId)
    .in("staff_id", ids)
    .gte("recorded_at", win.from)
    .lt("recorded_at", win.to)
    .order("recorded_at", { ascending: false })
    .limit(3000);
  if (pointErr) throw new Error(pointErr.message);

  const byStaff = new Map<string, PointLite[]>();
  for (const row of (points || []) as PointLite[]) {
    const list = byStaff.get(row.staff_id) || [];
    list.push(row);
    byStaff.set(row.staff_id, list);
  }

  return staff.map((row) => {
    const st = statusFor(byStaff.get(row.id) || []);
    const mins = st.lastAt ? minutesAgo(st.lastAt) : null;
    return {
      id: row.id,
      nama: row.nama,
      role: row.role,
      label: st.label,
      lastAt: st.lastAt,
      minutesAgo: mins,
      checkinPagi: st.checkinPagi,
      checkinSore: st.checkinSore,
      visits: st.visits,
      meaning: meaningFor(st.label, mins),
    };
  });
}

export function formatHrBrief(people: FieldPerson[], title = "Ringkas HRD lapangan") {
  const parts = wibParts();
  const label = `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}`;
  const counts: Record<FieldStatusLabel, number> = {
    Live: 0,
    Aktif: 0,
    Sepi: 0,
    Senyap: 0,
    Offline: 0,
    Selesai: 0,
  };
  for (const p of people) counts[p.label] += 1;

  const lines = [
    "HRD Henima",
    `${title} · ${label} · data live dari GPS`,
    `Live ${counts.Live} · Aktif ${counts.Aktif} · Sepi ${counts.Sepi} · Senyap ${counts.Senyap} · Offline ${counts.Offline} · Selesai ${counts.Selesai}`,
    "",
  ];

  if (!people.length) {
    lines.push("Belum ada sales/leader aktif di tim.");
    return lines.join("\n");
  }

  for (const p of people) {
    const last =
      p.lastAt && p.minutesAgo != null
        ? `titik terakhir ${clockWib(p.lastAt)} WIB (±${p.minutesAgo} mnt)`
        : "belum ada titik hari ini";
    const absen = p.checkinPagi ? "absen pagi ✓" : "belum absen pagi";
    const visit = `kunjungan ${p.visits}`;
    lines.push(`• ${p.nama} — ${p.label}`);
    lines.push(`  ${last} · ${absen} · ${visit}`);
    if (p.label === "Senyap" || p.label === "Sepi" || p.label === "Offline") {
      lines.push(`  Arti: ${p.meaning}`);
    }
  }

  const hour = wibHourNow();
  if (hour >= TRACKING_AUTO_CLOSE_HOUR) {
    lines.push("", `Catatan: di atas jam ${TRACKING_AUTO_CLOSE_HOUR}:00 WIB sesi GPS otomatis tutup.`);
  }
  lines.push("", `Sumber: titik GPS hari ini (${todayWib()}). Angka di atas dari database, bukan tebakan.`);
  return lines.join("\n");
}

export function formatSenyapAlert(person: FieldPerson, remindCount = 1) {
  const last =
    person.lastAt && person.minutesAgo != null
      ? `Titik terakhir ${clockWib(person.lastAt)} WIB (±${person.minutesAgo} menit).`
      : "Titik terakhir tidak terbaca.";
  const head =
    remindCount <= 1
      ? "HRD Henima — alert lapangan"
      : `HRD Henima — pengingat #${remindCount} (masih belum normal)`;
  return [
    head,
    `${person.nama} status SENYAP.`,
    last,
    `Absen pagi: ${person.checkinPagi ? "sudah" : "belum"} · Kunjungan hari ini: ${person.visits}.`,
    "",
    "Arti akurat:",
    "App di HP sales berhenti kirim lokasi. Bukan tebak “diam di rumah”.",
    "Penyebab paling sering: Force stop, clear RAM, swipe+bunuh app, atau hemat baterai mematikan app.",
    "",
    remindCount <= 1
      ? "Sudah dihubungi? Minta buka lagi Henima Sales + izinkan lokasi."
      : `Masih Senyap. Sudah sempat chat ${person.nama}? Kalau belum, hubungi sekarang. Kalau sudah, minta jangan Force stop / matikan app.`,
  ].join("\n");
}

export function formatSepiAlert(person: FieldPerson) {
  const last =
    person.lastAt && person.minutesAgo != null
      ? `Titik terakhir ${clockWib(person.lastAt)} WIB (±${person.minutesAgo} menit).`
      : "Titik terakhir tidak terbaca.";
  return [
    "HRD Henima — early warn",
    `${person.nama} mulai SEPI (belum Senyap penuh).`,
    last,
    "Jeda GPS sudah >10 menit. Pantau supaya tidak kecolongan kalau app dimatikan.",
    "Kalau lanjut diam sampai 20 menit, saya naikkan ke alert SENYAP.",
  ].join("\n");
}

export function formatIncidentAlert(opts: {
  nama: string;
  kind: "mock" | "lompatan";
  detail?: string;
  remindCount?: number;
}) {
  const head =
    (opts.remindCount || 1) <= 1
      ? "HRD Henima — sinyal curiga"
      : `HRD Henima — pengingat sinyal curiga #${opts.remindCount}`;
  if (opts.kind === "mock") {
    return [
      head,
      `${opts.nama}: percobaan lokasi PALSU (mock GPS) ditolak sistem.`,
      "Ini bukan GPS asli. Sales mungkin pakai fake GPS / mock location.",
      "Sudah sempat ditegur? Jangan biarkan lolos.",
    ].join("\n");
  }
  return [
    head,
    `${opts.nama}: lompatan lokasi tidak wajar ditolak.`,
    opts.detail || "Pergerakan antar titik terlalu cepat untuk lapangan normal.",
    "Bisa jadi fake GPS / manipulasi. Cek Command Center & tanya sales.",
  ].join("\n");
}

export function formatZeroVisitAlert(person: FieldPerson, remindCount = 1) {
  const head =
    remindCount <= 1
      ? "HRD Henima — tanpa kunjungan"
      : `HRD Henima — pengingat tanpa kunjungan #${remindCount}`;
  return [
    head,
    `${person.nama} sudah absen/ada GPS, tapi kunjungan hari ini masih 0.`,
    `Status sekarang: ${person.label}.`,
    "Sudah ditanya kenapa belum ada toko? Jangan sampai kecolongan kerja kosong.",
  ].join("\n");
}

export function formatBelumPulangAlert(person: FieldPerson, remindCount = 1) {
  const head =
    remindCount <= 1
      ? "HRD Henima — belum check-out"
      : `HRD Henima — pengingat belum pulang #${remindCount}`;
  return [
    head,
    `${person.nama} masih belum check-out sore.`,
    `Status: ${person.label} · kunjungan ${person.visits}.`,
    "Mendekati / lewat jam tutup. Sudah konfirmasi mereka masih di lapangan atau lupa tutup sesi?",
  ].join("\n");
}

export function formatAbsenReminder(people: FieldPerson[], remindCount = 1) {
  const list = people.filter((p) => !p.checkinPagi || p.label === "Offline");
  if (!list.length) return null;
  const head =
    remindCount <= 1
      ? "HRD Henima — belum absen / offline"
      : `HRD Henima — pengingat absen #${remindCount}`;
  return [
    head,
    "Masih ada yang belum siap di lapangan:",
    ...list.map(
      (p) =>
        `• ${p.nama}: ${p.label} · absen pagi ${p.checkinPagi ? "sudah" : "BELUM"}`,
    ),
    "",
    remindCount <= 1
      ? "Sudah sempat ingatkan tim? Minta buka app + absen pagi."
      : "Masih belum lengkap. Mau saya pantau terus — kabari lagi kalau belum beres.",
  ].join("\n");
}

export function formatKembaliAlert(person: FieldPerson) {
  const last =
    person.lastAt && person.minutesAgo != null
      ? `Titik terakhir ${clockWib(person.lastAt)} WIB (±${person.minutesAgo} menit).`
      : "GPS sudah kirim lagi.";
  return [
    "HRD Henima — update",
    `${person.nama} AKTIF lagi.`,
    last,
    "Sinyal GPS dari app sudah kembali. Pantauan lanjut normal.",
  ].join("\n");
}

/** Jawab pertanyaan owner dari data roster — angka selalu dari DB. */
export function answerHrQuestion(raw: string, people: FieldPerson[]): string | null {
  const q = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (!q) return null;

  const findByName = () =>
    people.find((p) => q.includes(p.nama.toLowerCase())) ||
    people.find((p) => p.nama.toLowerCase().split(/\s+/).some((part) => part.length > 2 && q.includes(part)));

  if (/arti\s+senyap|apa\s+itu\s+senyap|senyap\s+itu|arti\s+sepi|force\s*stop|dimati(kan|n)|matiin\s+apk|matikan\s+apk/.test(q)) {
    return [
      "HRD Henima",
      "Live ≤3 mnt · Aktif ≤10 mnt · Sepi 10–20 mnt · Senyap >20 mnt.",
      "Sepi = early warn. Senyap = app kemungkinan dimatikan / Force stop / clear RAM / hemat baterai.",
      "Bukan tebak lokasi rumah — ini sinyal GPS dari app yang mati/sepi.",
      "Offline = belum ada titik hari ini. Selesai = sudah check-out.",
      "Angka dari database Command Center, bukan tebakan.",
    ].join("\n");
  }

  if (/siapa\s+senyap|yang\s+senyap|list\s+senyap|ada\s+yang\s+senyap|siapa\s+sepi/.test(q)) {
    const list = people.filter((p) => p.label === "Senyap" || p.label === "Sepi");
    if (!list.length) return "HRD Henima\nSaat ini tidak ada yang Sepi/Senyap.";
    return [
      "HRD Henima — yang Sepi/Senyap sekarang",
      ...list.map(
        (p) =>
          `• ${p.nama}: ${p.label} · ±${p.minutesAgo} mnt · absen pagi ${p.checkinPagi ? "sudah" : "belum"} · kunjungan ${p.visits}`,
      ),
      "Minta buka lagi Henima Sales supaya tidak kecolongan.",
    ].join("\n");
  }

  if (/siapa\s+live|yang\s+live|siapa\s+aktif|yang\s+jalan|siapa\s+kerja/.test(q)) {
    const list = people.filter((p) => p.label === "Live" || p.label === "Aktif");
    if (!list.length) return "HRD Henima\nBelum ada yang Live/Aktif saat ini.";
    return [
      "HRD Henima — yang masih kirim GPS",
      ...list.map((p) => `• ${p.nama}: ${p.label} · ±${p.minutesAgo} mnt · kunjungan ${p.visits}`),
    ].join("\n");
  }

  if (/belum\s+absen|siapa\s+belum|offline|tidak\s+hadir|enggak\s+masuk|nggak\s+masuk/.test(q)) {
    const list = people.filter((p) => !p.checkinPagi || p.label === "Offline");
    if (!list.length) return "HRD Henima\nSemua sales aktif sudah ada absen/titik pagi (atau tidak Offline).";
    return [
      "HRD Henima — belum absen / offline",
      ...list.map(
        (p) =>
          `• ${p.nama}: ${p.label} · absen pagi ${p.checkinPagi ? "sudah" : "belum"} · titik ${p.lastAt ? "ada" : "belum"}`,
      ),
    ].join("\n");
  }

  if (/kunjungan|visit|toko/.test(q)) {
    const named = findByName();
    if (named) {
      return `HRD Henima\n${named.nama}: ${named.visits} kunjungan tercatat hari ini · status ${named.label}.`;
    }
    const ranked = [...people].sort((a, b) => b.visits - a.visits);
    return [
      "HRD Henima — kunjungan hari ini",
      ...ranked.map((p) => `• ${p.nama}: ${p.visits} · ${p.label}`),
    ].join("\n");
  }

  const named = findByName();
  if (named && /(status|gimana|bagaimana|dimana|di mana|senyap|live|aktif|absen)/.test(q)) {
    const last =
      named.lastAt && named.minutesAgo != null
        ? `Titik terakhir ${clockWib(named.lastAt)} WIB (±${named.minutesAgo} mnt).`
        : "Belum ada titik hari ini.";
    return [
      `HRD Henima — ${named.nama}`,
      `Status: ${named.label}`,
      last,
      `Absen pagi: ${named.checkinPagi ? "sudah" : "belum"} · Check-out: ${named.checkinSore ? "sudah" : "belum"} · Kunjungan: ${named.visits}`,
      `Arti: ${named.meaning}`,
    ].join("\n");
  }

  if (/laporan|ringkas|status|tim|semua|hari\s+ini|brief|hrd|absensi/.test(q)) {
    return formatHrBrief(people);
  }

  if (/kamu\s+siapa|ini\s+bot\s+apa|asisten|hrd/.test(q)) {
    return [
      "Saya HRD Henima di Telegram — asisten owner untuk pantauan lapangan.",
      "Saya baca data GPS & absen dari Command Center, lalu kasih kabar akurat ke kamu.",
      "Bot sales terpisah; di sini khusus status tim, Senyap, absen, kunjungan.",
      "Tanya contoh: “siapa senyap”, “status Ismail”, “belum absen”, “kunjungan hari ini”.",
    ].join("\n");
  }

  return null;
}

export const HR_HELP = [
  "HRD Henima — asisten lapangan buat kamu.",
  "Saya pantau otomatis biar tidak kecolongan: Sepi, Senyap, belum absen, 0 kunjungan, mock GPS, lompatan aneh, belum check-out.",
  "Kalau belum beres, saya ulang ingatkan.",
  "",
  "Perintah:",
  "/status atau /laporan — ringkas akurat hari ini",
  "/help — bantuan",
  "",
  "Bisa ketik biasa:",
  "• siapa senyap",
  "• status [nama]",
  "• belum absen",
  "• kunjungan hari ini",
  "• arti senyap",
].join("\n");
