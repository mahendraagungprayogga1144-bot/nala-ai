import "server-only";
import { todayWib } from "@/lib/date";
import type { SalesDb } from "@/lib/henima-sales/db";
import { TRACKING_AUTO_CLOSE_HOUR, wibHourNow } from "./schedule";
import { claimOnce, claimOrRemind } from "./alert-claim";
import { notifyFoundersTelegram } from "./owner-telegram";
import {
  formatAbsenReminder,
  formatBelumPulangAlert,
  formatHrBrief,
  formatIncidentAlert,
  formatKembaliAlert,
  formatSenyapAlert,
  formatSepiAlert,
  formatZeroVisitAlert,
  loadHrFieldRoster,
  type FieldPerson,
} from "./owner-hr";

const DUTY_START_HOUR = 8;
/** Lebih agresif: ulang tiap 30 mnt selama masih belum normal. */
const REMIND_MS = 30 * 60_000;
const ABSEN_REMIND_MS = 45 * 60_000;
const INCIDENT_REMIND_MS = 20 * 60_000;
const ZERO_VISIT_REMIND_MS = 60 * 60_000;
const PULANG_REMIND_MS = 30 * 60_000;

function inDutyHours(date = new Date()) {
  const h = wibHourNow(date);
  return h >= DUTY_START_HOUR && h < TRACKING_AUTO_CLOSE_HOUR;
}

async function remindAbsenIfNeeded(db: SalesDb, businessId: string, day: string, people: FieldPerson[]) {
  const hour = wibHourNow();
  if (hour < 9) return 0;
  const pending = people.filter((p) => !p.checkinPagi || p.label === "Offline");
  if (!pending.length) return 0;

  const claim = await claimOrRemind(db, businessId, day, "absen", null, ABSEN_REMIND_MS);
  if (!claim.ok) return 0;
  const text = formatAbsenReminder(pending, claim.count);
  if (!text) return 0;
  const res = await notifyFoundersTelegram(db, businessId, text);
  return res.sent > 0 ? 1 : 0;
}

async function remindZeroVisit(db: SalesDb, businessId: string, day: string, people: FieldPerson[]) {
  // Siang: sudah absen tapi 0 kunjungan = risiko kerja kosong.
  if (wibHourNow() < 14) return 0;
  let n = 0;
  for (const person of people) {
    if (!person.checkinPagi && person.label === "Offline") continue;
    if (person.checkinSore) continue;
    if (person.visits > 0) continue;
    if (person.label === "Offline" && !person.checkinPagi) continue;
    // Ada jejak hari ini (bukan offline kosong) tapi 0 visit.
    if (!person.lastAt && !person.checkinPagi) continue;
    const claim = await claimOrRemind(db, businessId, day, "zero_visit", person.id, ZERO_VISIT_REMIND_MS);
    if (!claim.ok) continue;
    const res = await notifyFoundersTelegram(db, businessId, formatZeroVisitAlert(person, claim.count));
    if (res.sent > 0) n += 1;
  }
  return n;
}

async function remindBelumPulang(db: SalesDb, businessId: string, day: string, people: FieldPerson[]) {
  if (wibHourNow() < TRACKING_AUTO_CLOSE_HOUR - 1) return 0;
  let n = 0;
  for (const person of people) {
    if (person.checkinSore || person.label === "Selesai") continue;
    if (!person.lastAt && !person.checkinPagi) continue;
    const claim = await claimOrRemind(db, businessId, day, "belum_pulang", person.id, PULANG_REMIND_MS);
    if (!claim.ok) continue;
    const res = await notifyFoundersTelegram(db, businessId, formatBelumPulangAlert(person, claim.count));
    if (res.sent > 0) n += 1;
  }
  return n;
}

/** Pantauan penuh: sepi → senyap → absen → zero visit → belum pulang → kembali. */
export async function watchSilentForBusiness(db: SalesDb, businessId: string) {
  const hour = wibHourNow();
  const day = todayWib();
  const people = await loadHrFieldRoster(db, businessId);
  let senyap = 0;
  let sepi = 0;
  let kembali = 0;
  const duty = inDutyHours();

  if (duty) {
    for (const person of people) {
      if (person.label === "Sepi" && person.lastAt) {
        const claim = await claimOnce(db, businessId, day, "sepi", person.id);
        if (claim) {
          const res = await notifyFoundersTelegram(db, businessId, formatSepiAlert(person));
          if (res.sent > 0) sepi += 1;
        }
      }

      if (person.label === "Senyap" && person.lastAt) {
        const claim = await claimOrRemind(db, businessId, day, "senyap", person.id, REMIND_MS);
        if (!claim.ok) continue;
        const res = await notifyFoundersTelegram(
          db,
          businessId,
          formatSenyapAlert(person, claim.count),
        );
        if (res.sent > 0) senyap += 1;
        continue;
      }

      if ((person.label === "Live" || person.label === "Aktif") && person.lastAt) {
        const { data: priors } = await db
          .from("module_henima_tracking_tg_alerts")
          .select("id")
          .eq("business_id", businessId)
          .eq("staff_id", person.id)
          .eq("day", day)
          .in("kind", ["senyap", "sepi"])
          .limit(1);
        if (!priors?.length) continue;
        const claimed = await claimOnce(db, businessId, day, "kembali", person.id);
        if (!claimed) continue;
        const res = await notifyFoundersTelegram(db, businessId, formatKembaliAlert(person));
        if (res.sent > 0) kembali += 1;
      }
    }
  }

  const absen = duty ? await remindAbsenIfNeeded(db, businessId, day, people) : 0;
  const zeroVisit = duty ? await remindZeroVisit(db, businessId, day, people) : 0;
  // Jam 17+ WIB: masih kabari yang belum check-out.
  const belumPulang = hour >= TRACKING_AUTO_CLOSE_HOUR - 1
    ? await remindBelumPulang(db, businessId, day, people)
    : 0;

  return { senyap, sepi, kembali, absen, zeroVisit, belumPulang };
}

/** Incident langsung: mock GPS / lompatan — jangan sampai kecolongan. */
export async function notifyOwnerIncident(
  db: SalesDb,
  opts: {
    businessId: string;
    staffId: string;
    nama: string;
    kind: "mock" | "lompatan";
    detail?: string;
  },
) {
  const day = todayWib();
  const claim = await claimOrRemind(
    db,
    opts.businessId,
    day,
    opts.kind,
    opts.staffId,
    INCIDENT_REMIND_MS,
  );
  if (!claim.ok) return { sent: 0 };
  const text = formatIncidentAlert({
    nama: opts.nama,
    kind: opts.kind,
    detail: opts.detail,
    remindCount: claim.count,
  });
  return notifyFoundersTelegram(db, opts.businessId, text);
}

export async function buildDailyFieldReport(db: SalesDb, businessId: string) {
  const people = await loadHrFieldRoster(db, businessId);
  return formatHrBrief(people, "Laporan HRD lapangan");
}

export async function openIssuesNudge(db: SalesDb, businessId: string) {
  const hour = wibHourNow();
  if (hour < DUTY_START_HOUR) return null;
  const people = await loadHrFieldRoster(db, businessId);
  const senyap = people.filter((p) => p.label === "Senyap");
  const sepi = people.filter((p) => p.label === "Sepi");
  const absen = people.filter((p) => !p.checkinPagi || p.label === "Offline");
  const zero = hour >= 14 ? people.filter((p) => (p.checkinPagi || p.lastAt) && !p.checkinSore && p.visits === 0) : [];
  if (!senyap.length && !sepi.length && !absen.length && !zero.length) return null;
  const bits: string[] = ["Follow-up:"];
  if (senyap.length) bits.push(`Senyap → ${senyap.map((p) => p.nama).join(", ")}`);
  if (sepi.length) bits.push(`Sepi → ${sepi.map((p) => p.nama).join(", ")}`);
  if (absen.length) bits.push(`Offline/belum absen → ${absen.map((p) => p.nama).join(", ")}`);
  if (zero.length) bits.push(`0 kunjungan → ${zero.map((p) => p.nama).join(", ")}`);
  bits.push("Sudah dihubungi?");
  return bits.join("\n");
}

export async function runOwnerFieldAlertsJob(db: SalesDb) {
  const { data: businesses, error } = await db
    .from("module_sales_staff")
    .select("business_id")
    .eq("role", "FOUNDER")
    .eq("status", "active");
  if (error) return { ok: false as const, error: error.message };

  const bizIds = [...new Set((businesses || []).map((r: { business_id: string }) => r.business_id))];
  const day = todayWib();
  const totals = { senyap: 0, sepi: 0, kembali: 0, absen: 0, zeroVisit: 0, belumPulang: 0, laporan: 0 };

  for (const businessId of bizIds) {
    try {
      const silent = await watchSilentForBusiness(db, businessId);
      totals.senyap += silent.senyap;
      totals.sepi += silent.sepi;
      totals.kembali += silent.kembali;
      totals.absen += silent.absen;
      totals.zeroVisit += silent.zeroVisit;
      totals.belumPulang += silent.belumPulang;

      const claimed = await claimOnce(db, businessId, day, "laporan", null);
      if (claimed) {
        const text = await buildDailyFieldReport(db, businessId);
        const res = await notifyFoundersTelegram(db, businessId, text);
        if (res.sent > 0) totals.laporan += 1;
      }
    } catch {
      /* lanjut */
    }
  }

  return { ok: true as const, businesses: bizIds.length, ...totals };
}

export async function ownerStatusText(db: SalesDb, businessId: string) {
  return buildDailyFieldReport(db, businessId);
}
