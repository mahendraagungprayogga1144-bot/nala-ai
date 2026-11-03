/**
 * Notifikasi HP untuk sales lapangan:
 * - Ongoing: GPS sedang mengirim (muncul di status bar)
 * - Reminder berkala: ngingetin jangan force-stop / matikan GPS
 */

import { isNativeApp } from "@/lib/henima-tracking/native-geo";

const ONGOING_ID = 36001;
const REMINDER_ID = 36002;
const CHANNEL_ID = "henima_gps_track";

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
      name: "Henima GPS Tracking",
      description: "Notifikasi jejak lokasi sales lapangan",
      importance: 5,
      visibility: 1,
      vibration: false,
      sound: undefined,
    });
  } catch {
    /* channel mungkin sudah ada / iOS */
  }
}

/** Tampilkan notif ongoing + jadwalkan reminder tiap jam. */
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
            title: "Henima · GPS live",
            body: `${nama}: titik dikirim terus ke owner. Jangan force-stop app.`,
            channelId: CHANNEL_ID,
            ongoing: true,
            autoCancel: false,
            extra: { kind: "ongoing" },
          },
          {
            id: REMINDER_ID,
            title: "Henima ngingetin",
            body: "Cek GPS masih Izinkan selalu. Biarkan Henima Sales hidup di belakang.",
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

  // Browser / Chrome: pakai notification SW bila ada
  try {
    if (!("serviceWorker" in navigator)) {
      new Notification("Henima · GPS live", {
        body: "Titik dikirim terus. Jangan tutup tab ini.",
        tag: "henima-auto-track",
        requireInteraction: true,
      });
      return true;
    }
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("Henima · GPS live", {
      body: "Titik dikirim terus (Life360). Jangan tutup tab sampai selesai kerja.",
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
      await LocalNotifications.cancel({ notifications: [{ id: ONGOING_ID }, { id: REMINDER_ID }] });
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
