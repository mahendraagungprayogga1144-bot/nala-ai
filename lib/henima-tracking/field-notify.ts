/**
 * Notifikasi HP untuk sales lapangan:
 * - Ongoing ringan saat sesi kerja
 * - Coach harian berulang (tetap bunyi meski app ditutup / swipe RAM)
 *   — sekali dijadwal di APK, mengulang tiap hari sampai Force stop / clear data
 */

import { isNativeApp } from "@/lib/henima-tracking/native-geo";

const ONGOING_ID = 36001;
const CHECKIN_ID = 36010;
const COACH_IDS = [36011, 36012, 36013] as const;
const CHANNEL_ID = "henima_field";

/** Slot coach harian (jam lokal HP — di ID = WIB). */
export const SALES_COACH_SLOTS = [
  { hour: 11, minute: 0, title: "HENIMA · Siang", body: "Siang. Cek penjualan hari ini — catat tiap transaksi, yang kecil tetap dihitung." },
  { hour: 15, minute: 0, title: "HENIMA · Semangat jual", body: "Pukul 15. Tingkatkan penjualan hari ini. Ayo gas lagi." },
  { hour: 16, minute: 30, title: "HENIMA · Sore", body: "Sore menjelang. Satu usaha lagi sebelum tutup — kamu diperhatikan." },
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

/**
 * Jadwalkan notif HARIAN berulang + check-in pagi.
 * Tetap hidup setelah swipe clear RAM (bukan Force stop).
 * Dipanggil saat portal dibuka; setelah itu mengulang sendiri tiap hari.
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
      notifications: [{ id: CHECKIN_ID }, ...COACH_IDS.map((id) => ({ id }))],
    });

    const nama = opts.nama?.trim() || "Sales";
    const omzetHari = Number(opts.omzetHari) || 0;
    const transaksiHari = Number(opts.transaksiHari) || 0;
    const omzetHint =
      omzetHari > 0 || transaksiHari > 0
        ? ` Terakhir tercatat ${rp(omzetHari)} · ${Math.round(transaksiHari)} transaksi.`
        : "";

    const notifications = [
      {
        id: CHECKIN_ID,
        title: "HENIMA · Pagi",
        body: `${nama}, absen dulu lalu gas jualan.${omzetHint} Yang kecil tetap dihitung.`,
        channelId: CHANNEL_ID,
        schedule: {
          on: { hour: 7, minute: 30 },
          repeats: true,
          allowWhileIdle: true,
        },
        extra: { kind: "checkin-coach" },
      },
      ...SALES_COACH_SLOTS.map((slot, i) => ({
        id: COACH_IDS[i],
        title: slot.title,
        body: `${nama}, ${slot.body}${i === 1 && omzetHint ? omzetHint : ""}`,
        channelId: CHANNEL_ID,
        schedule: {
          on: { hour: slot.hour, minute: slot.minute },
          repeats: true,
          allowWhileIdle: true,
        },
        extra: { kind: "sales-coach", hour: slot.hour },
      })),
    ];

    await LocalNotifications.schedule({ notifications });
    return true;
  } catch {
    return false;
  }
}

/** Notif sesi kerja (saat app/GPS watcher aktif). Tanpa spam tiap jam. */
export async function startFieldTrackingNotify(opts?: { nama?: string }) {
  const nama = opts?.nama?.trim() || "Sales";
  const ok = await requestFieldNotifyPermission();
  if (!ok) return false;

  if (await isNativeApp()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await ensureAndroidChannel();
      await LocalNotifications.cancel({ notifications: [{ id: ONGOING_ID }] });
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
        ],
      });
      return true;
    } catch {
      return false;
    }
  }

  try {
    if (typeof window !== "undefined") {
      const key = "henima_field_notify_shown";
      if (sessionStorage.getItem(key) === "1") return true;
      sessionStorage.setItem(key, "1");
    }
    if (!("serviceWorker" in navigator)) {
      new Notification("HENIMA", {
        body: "Semangat kerja hari ini.",
        tag: "henima-session",
        requireInteraction: false,
      });
      return true;
    }
    const reg = await navigator.serviceWorker.ready;
    const old = await reg.getNotifications({ tag: "henima-auto-track" });
    old.forEach((note) => note.close());
    const old2 = await reg.getNotifications({ tag: "henima-session" });
    old2.forEach((note) => note.close());
    await reg.showNotification("HENIMA", {
      body: "Semangat kerja hari ini.",
      tag: "henima-session",
      requireInteraction: false,
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
      // Hanya tutup ongoing sesi — coach harian tetap jalan.
      await LocalNotifications.cancel({
        notifications: [{ id: ONGOING_ID }],
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
    const notes2 = await reg.getNotifications({ tag: "henima-session" });
    notes2.forEach((note) => note.close());
  } catch {
    /* ignore */
  }
}
