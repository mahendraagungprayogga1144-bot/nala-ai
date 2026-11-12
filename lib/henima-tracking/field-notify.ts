/**
 * Notifikasi HP untuk sales lapangan:
 * - Ongoing ringan saat sesi kerja (tanpa bocor detail teknis)
 * - Coach penjualan jam tertentu (omzet hari ini + dorongan)
 */

import { isNativeApp } from "@/lib/henima-tracking/native-geo";
import { TRACKING_AUTO_CLOSE_HOUR, wibParts } from "@/lib/henima-tracking/schedule";

const ONGOING_ID = 36001;
const REMINDER_ID = 36002;
const COACH_IDS = [36011, 36012, 36013] as const;
const CHANNEL_ID = "henima_field";

/** Jam coach penjualan (WIB). */
export const SALES_COACH_SLOTS = [
  { hour: 11, minute: 0 },
  { hour: 15, minute: 0 },
  { hour: 16, minute: 30 },
] as const;

export async function requestFieldNotifyPermission() {
  if (await isNativeApp()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const current = await LocalNotifications.checkPermissions();
      if (current.display !== "granted") {
        const next = await LocalNotifications.requestPermissions();
        return next.display === "granted";
      }
      return true;
    } catch {
      return false;
    }
  }
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

async function ensureAndroidChannel() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Henima Sales",
      description: "Pengingat kerja & penjualan lapangan",
      importance: 4,
      visibility: 1,
      vibration: true,
      sound: undefined,
    });
  } catch {
    /* channel mungkin sudah ada / iOS */
  }
}

function rp(n: number) {
  return `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
}

/** Waktu lokal device yang mewakili jam:menit WIB hari ini (atau null jika sudah lewat). */
export function nextWibSlotDate(hour: number, minute: number, from = new Date()) {
  const p = wibParts(from);
  // WIB = UTC+7 → simpan sebagai UTC wall-clock equivalent
  const utcMs = Date.UTC(p.year, p.month - 1, p.day, hour - 7, minute, 0, 0);
  const target = new Date(utcMs);
  if (target.getTime() <= from.getTime() + 45_000) return null;
  if (hour > TRACKING_AUTO_CLOSE_HOUR || (hour === TRACKING_AUTO_CLOSE_HOUR && minute > 0)) return null;
  return target;
}

function coachBody(opts: {
  nama: string;
  hour: number;
  omzetHari: number;
  transaksiHari: number;
}) {
  const nama = opts.nama.trim() || "Sales";
  const omzet = rp(opts.omzetHari);
  const trx = Math.max(0, Math.round(opts.transaksiHari || 0));
  if (opts.hour < 12) {
    return `${nama}, pagi sudah jalan. Hari ini ${omzet} · ${trx} transaksi. Ayo gas lagi — yang kecil tetap dihitung.`;
  }
  if (opts.hour < 16) {
    return `${nama}, pukul ${opts.hour}. Penjualan hari ini ${omzet} (${trx} transaksi). Tingkatkan lagi, masih ada waktu.`;
  }
  return `${nama}, sore menjelang. Omzet hari ini ${omzet}. Satu usaha lagi sebelum tutup — kamu diperhatikan.`;
}

/**
 * Jadwalkan notif coach di jam 11 / 15 / 16:30 WIB dengan omzet terkini.
 * Dipanggil tiap kali portal/data dimuat supaya angkanya segar.
 */
export async function scheduleSalesCoachNotifications(opts: {
  nama?: string;
  omzetHari?: number;
  transaksiHari?: number;
}) {
  if (!(await isNativeApp())) return false;
  const ok = await requestFieldNotifyPermission();
  if (!ok) return false;

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await ensureAndroidChannel();
    await LocalNotifications.cancel({
      notifications: COACH_IDS.map((id) => ({ id })),
    });

    const nama = opts.nama?.trim() || "Sales";
    const omzetHari = Number(opts.omzetHari) || 0;
    const transaksiHari = Number(opts.transaksiHari) || 0;
    const notifications = [];

    for (let i = 0; i < SALES_COACH_SLOTS.length; i++) {
      const slot = SALES_COACH_SLOTS[i];
      const at = nextWibSlotDate(slot.hour, slot.minute);
      if (!at) continue;
      notifications.push({
        id: COACH_IDS[i],
        title: "HENIMA · Semangat jual",
        body: coachBody({ nama, hour: slot.hour, omzetHari, transaksiHari }),
        channelId: CHANNEL_ID,
        schedule: { at, allowWhileIdle: true },
        extra: { kind: "sales-coach", hour: slot.hour },
      });
    }

    if (!notifications.length) return true;
    await LocalNotifications.schedule({ notifications });
    return true;
  } catch {
    return false;
  }
}

/** Tampilkan notif sesi kerja + reminder lembut (bukan tip teknis GPS). */
export async function startFieldTrackingNotify(opts?: { nama?: string }) {
  const nama = opts?.nama?.trim() || "Sales";
  const ok = await requestFieldNotifyPermission();
  if (!ok) return false;

  if (await isNativeApp()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await ensureAndroidChannel();
      await LocalNotifications.cancel({ notifications: [{ id: ONGOING_ID }, { id: REMINDER_ID }] });
      await LocalNotifications.schedule({
        notifications: [
          {
            id: ONGOING_ID,
            title: "HENIMA · Sesi kerja",
            body: `${nama}: tetap semangat. Catat tiap jual — yang kecil pun berharga.`,
            channelId: CHANNEL_ID,
            ongoing: true,
            autoCancel: false,
            extra: { kind: "ongoing" },
          },
          {
            id: REMINDER_ID,
            title: "HENIMA ngingetin",
            body: "Masih di lapangan? Cek target hari ini dan gas satu transaksi lagi.",
            channelId: CHANNEL_ID,
            schedule: {
              every: "hour",
              repeats: true,
            },
            extra: { kind: "reminder" },
          },
        ],
      });
      return true;
    } catch {
      return false;
    }
  }

  try {
    if (!("serviceWorker" in navigator)) {
      new Notification("HENIMA · Sesi kerja", {
        body: "Tetap semangat catat jual hari ini.",
        tag: "henima-auto-track",
        requireInteraction: true,
      });
      return true;
    }
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("HENIMA · Sesi kerja", {
      body: "Tetap semangat catat jual hari ini.",
      tag: "henima-auto-track",
      requireInteraction: true,
      data: { url: window.location.href },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopFieldTrackingNotify() {
  if (await isNativeApp()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.cancel({
        notifications: [{ id: ONGOING_ID }, { id: REMINDER_ID }, ...COACH_IDS.map((id) => ({ id }))],
      });
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const notes = await reg.getNotifications({ tag: "henima-auto-track" });
    notes.forEach((note) => note.close());
  } catch {
    /* ignore */
  }
}
