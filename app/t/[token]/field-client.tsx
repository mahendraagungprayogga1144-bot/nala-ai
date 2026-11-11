"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapsUrl } from "@/lib/henima-tracking/shared";
import {
  ensureNativeLocationPermissions,
  isNativeApp,
  openNativeLocationSettings,
  readNativeOrBrowserGps,
  watchNativeOrBrowserGps,
} from "@/lib/henima-tracking/native-geo";
import { startFieldTrackingNotify, stopFieldTrackingNotify } from "@/lib/henima-tracking/field-notify";
import { prepareFieldPhoto } from "@/lib/henima-tracking/field-photo";
import { isPastTrackingAutoClose, TRACKING_AUTO_CLOSE_HOUR } from "@/lib/henima-tracking/schedule";
import { startNativeBackgroundTrack, stopNativeBackgroundTrack } from "@/lib/henima-tracking/native-track";

export type FieldPoint = {
  id: string;
  kind: "checkin_pagi" | "checkin_sore" | "visit" | "ping" | "qris";
  lat: number;
  lng: number;
  accuracy_m: number | null;
  note: string | null;
  late: boolean;
  recorded_at: string;
  maps: string;
  photo_url: string | null;
};

export type FieldState = {
  nama: string;
  role: string;
  staffId: string;
  businessId: string;
  date: string;
  hour: number;
  lateWindow: boolean;
  beforeDuty: boolean;
  checkedIn: boolean;
  checkedOut: boolean;
  /** Ada check-in pagi (foto absensi) hari ini — beda dari tracking ping. */
  hasCheckinPagi?: boolean;
  points: FieldPoint[];
};

type GpsFix = { lat: number; lng: number; acc: number };

const KIND_LABEL: Record<FieldPoint["kind"], string> = {
  checkin_pagi: "Absensi pagi",
  checkin_sore: "Tutup jam 18:00",
  visit: "Catat toko",
  ping: "Jejak",
  qris: "Tampil QRIS",
};

function clock(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function pesanDb(message: string) {
  if (message.includes("BELUM_CHECKIN")) return "Belum absensi pagi. Ambil 1 foto dulu.";
  if (message.includes("SUDAH_CHECKOUT")) return `GPS sudah berhenti (auto jam ${TRACKING_AUTO_CLOSE_HOUR}:00). Besok buka lagi.`;
  if (message.includes("TIDAK_LOGIN")) return "Link ini belum aktif di database. Minta founder paste SQL field token.";
  if (message.includes("DATA_TIDAK_VALID")) return "Data tidak valid. Cek foto & GPS, atau absensi pagi sudah pernah dikirim.";
  if (message.includes("Could not find the function") || message.includes("schema cache")) {
    return "Sistem lapangan belum aktif. Minta founder jalankan SQL henima_tracking_field di Supabase.";
  }
  return message;
}

export default function FieldClient({
  token,
  initial,
  embedded = false,
  onBack,
  onStatusChange,
}: {
  token: string;
  initial: FieldState;
  embedded?: boolean;
  onBack?: () => void;
  onStatusChange?: (status: { checkedIn: boolean; checkedOut: boolean; watching: boolean }) => void;
}) {
  const [state, setState] = useState(initial);
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [gpsText, setGpsText] = useState("Belum diambil");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [watching, setWatching] = useState(false);
  const [inBackground, setInBackground] = useState(false);
  const [nativeApp, setNativeApp] = useState(false);
  const [permHint, setPermHint] = useState("");
  const [qrisUrl, setQrisUrl] = useState("");
  const [showQris, setShowQris] = useState(false);
  const [qrisZoom, setQrisZoom] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const lastSent = useRef(0);
  const lastPos = useRef<GpsFix | null>(null);
  const pingBusy = useRef(false);
  const pendingPing = useRef<GpsFix | null>(null);
  const pingFailStreak = useRef(0);
  const previewUrl = useRef("");
  const autoClosedRef = useRef(false);

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat jejak."));
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function setPhotoFile(file: File | null) {
    setPhoto(file);
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = file ? URL.createObjectURL(file) : "";
    setPreview(previewUrl.current);
  }

  async function refresh() {
    const response = await fetch(`/api/henima-tracking/field/${token}`, { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || "Gagal memuat jejak hari ini.");
    const points = (json.points || []) as FieldPoint[];
    const hasCheckinPagi =
      typeof json.hasCheckinPagi === "boolean"
        ? json.hasCheckinPagi
        : points.some((point) => point.kind === "checkin_pagi");
    setState((prev) => ({
      ...prev,
      date: json.date || prev.date,
      points,
      checkedIn: Boolean(json.checkedIn),
      checkedOut: Boolean(json.checkedOut),
      hasCheckinPagi,
    }));
    setQrisUrl(typeof json.qrisUrl === "string" ? json.qrisUrl : "");
  }

  async function uploadPhoto(file: File) {
    const ready = await prepareFieldPhoto(file);
    const form = new FormData();
    form.append("file", ready);
    const response = await fetch(`/api/henima-tracking/field/${token}/photo`, { method: "POST", body: form });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || "Upload foto gagal.");
    return String(json.path);
  }

  async function resolveActionGps(fix: GpsFix, kind: FieldPoint["kind"]): Promise<GpsFix> {
    if (kind === "ping" || fix.acc <= 250) return fix;
    // Live force-ping sering kasar — untuk absensi/nawar/QRIS ambil ulang akurat.
    try {
      let best = fix;
      for (let i = 0; i < 3; i++) {
        const next = await readNativeOrBrowserGps();
        if (next.acc < best.acc) best = next;
        if (best.acc <= 80) break;
        await new Promise((r) => setTimeout(r, 700));
      }
      setGps(best);
      setGpsText(`Lokasi didapat. Akurasi ±${best.acc} m${nativeApp ? " · app" : ""}`);
      if (best.acc > 250) {
        throw new Error("Sinyal GPS masih kasar. Ambil lokasi lagi di tempat terbuka.");
      }
      return best;
    } catch (err) {
      if (err instanceof Error && /kasar|GPS|lokasi|timeout/i.test(err.message)) throw err;
      throw new Error("Sinyal GPS masih kasar. Ambil lokasi lagi di tempat terbuka.");
    }
  }

  async function send(kind: FieldPoint["kind"], fix: GpsFix, file?: File | null, place?: string) {
    const useFix = await resolveActionGps(fix, kind);
    let photoPath: string | null = null;
    if (file) photoPath = await uploadPhoto(file);

    const supabase = createClient();
    const accuracy = Math.round(useFix.acc);
    const error =
      kind === "checkin_pagi"
        ? (
            await supabase.rpc("henima_tracking_field_checkin", {
              p_token: token,
              p_lat: useFix.lat,
              p_lng: useFix.lng,
              p_accuracy_m: accuracy,
              p_photo_path: photoPath,
            })
          ).error
        : kind === "checkin_sore"
          ? (
              await supabase.rpc("henima_tracking_field_checkout", {
                p_token: token,
                p_lat: useFix.lat,
                p_lng: useFix.lng,
                p_accuracy_m: accuracy,
                p_photo_path: photoPath,
              })
            ).error
          : kind === "visit"
            ? (
                await supabase.rpc("henima_tracking_field_kunjungan", {
                  p_token: token,
                  p_lat: useFix.lat,
                  p_lng: useFix.lng,
                  p_accuracy_m: accuracy,
                  p_note: place || null,
                  p_photo_path: photoPath,
                })
              ).error
            : kind === "qris"
              ? (
                  await supabase.rpc("henima_tracking_field_qris", {
                    p_token: token,
                    p_lat: useFix.lat,
                    p_lng: useFix.lng,
                    p_accuracy_m: accuracy,
                  })
                ).error
              : null;

    if (kind === "ping") {
      // Lewat API supaya titik juga bisa di-forward ke Traccar (akurasi ikut dikirim).
      const response = await fetch(`/api/henima-tracking/field/${token}/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: useFix.lat, lng: useFix.lng, accuracy_m: accuracy }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(pesanDb(json.error || "Gagal kirim titik GPS."));
      if (json.closed) throw new Error(pesanDb(json.error || "SUDAH_CHECKOUT"));
    } else if (error) {
      throw new Error(pesanDb(error.message));
    } else {
      // Check-in / kunjungan / QRIS: cadangan ke Traccar (gagal diam, HENIMA tetap utama).
      void fetch(`/api/henima-tracking/field/${token}/traccar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: useFix.lat, lng: useFix.lng, accuracy_m: accuracy }),
      }).catch(() => {});
    }
    lastSent.current = Date.now();
    lastPos.current = useFix;
    // Ping sering — jangan refresh full setiap titik (bikin lag & skip update).
    if (kind !== "ping") await refresh();
  }

  useEffect(() => {
    void isNativeApp().then(async (native) => {
      setNativeApp(native);
      if (!native) return;
      const perm = await ensureNativeLocationPermissions();
      setPermHint(perm.message);
    });
  }, []);

  useEffect(() => {
    onStatusChange?.({
      checkedIn: state.checkedIn,
      checkedOut: state.checkedOut,
      watching,
    });
  }, [state.checkedIn, state.checkedOut, watching, onStatusChange]);

  function grabGps() {
    setError("");
    setGpsText("Mengambil lokasi GPS akurat...");
    void (async () => {
      if (nativeApp) {
        const perm = await ensureNativeLocationPermissions();
        setPermHint(perm.message);
        if (!perm.ok) {
          setGpsText(perm.message);
          setError(perm.message);
          return;
        }
      }
      try {
        // Ambil beberapa kali, pakai yang paling akurat.
        let best: { lat: number; lng: number; acc: number } | null = null;
        for (let i = 0; i < 5; i++) {
          const fix = await readNativeOrBrowserGps();
          if (!best || fix.acc < best.acc) best = fix;
          if (fix.acc <= 15) break;
          await new Promise((r) => setTimeout(r, 800));
        }
        if (!best) throw new Error("GPS kosong");
        setGps(best);
        setGpsText(
          best.acc <= 40
            ? `Lokasi bagus ±${best.acc} m${nativeApp ? " · app" : ""}`
            : `Lokasi ±${best.acc} m — ke tempat terbuka biar lebih akurat`,
        );
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "code" in err && (err as { code: number }).code === 1
            ? 'Izinkan lokasi. Pilih "Izinkan selalu".'
            : err instanceof Error && /timeout/i.test(err.message)
              ? "GPS timeout. Coba di tempat terbuka (langit terlihat)."
              : "GPS gagal. Nyalakan lokasi HP.";
        setGpsText(msg);
        setError(msg);
      }
    })();
  }

  useEffect(() => {
    // GPS jalan sejak buka app. Auto stop jam 18:00 WIB — tanpa tombol selesai kerja.
    if (state.checkedOut || isPastTrackingAutoClose()) return;

    let alive = true;
    let wake: WakeLockSentinel | null = null;
    let stopWatch: (() => void) | null = null;

    const flushPing = (fix: GpsFix) => {
      if (!alive || isPastTrackingAutoClose()) return;
      if (pingBusy.current) {
        pendingPing.current = fix;
        return;
      }
      pingBusy.current = true;
      void send("ping", fix)
        .then(() => {
          pingFailStreak.current = 0;
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : "Gagal kirim titik GPS.";
          if (/berhenti|18:00|CHECKOUT/i.test(msg)) {
            alive = false;
            setState((prev) => ({ ...prev, checkedOut: true }));
            setWatching(false);
            setGpsText(`GPS otomatis berhenti jam ${TRACKING_AUTO_CLOSE_HOUR}:00`);
            void stopFieldTrackingNotify();
            void stopNativeBackgroundTrack();
            return;
          }
          // BELUM_CHECKIN / error jaringan: jangan matikan watcher — terus coba.
          pingFailStreak.current += 1;
          if (pingFailStreak.current <= 2 || pingFailStreak.current % 8 === 0) {
            setError(`GPS: ${msg}`);
            setGpsText(`Gagal kirim · ${msg}`);
          }
          if (nativeApp && pingFailStreak.current % 5 === 0) {
            void startNativeBackgroundTrack(token);
          }
        })
        .finally(() => {
          pingBusy.current = false;
          const queued = pendingPing.current;
          pendingPing.current = null;
          if (queued && alive) flushPing(queued);
        });
    };

    const pushPing = (fix: GpsFix, force = false) => {
      if (!alive || isPastTrackingAutoClose()) return;
      // Update UI: terima akurasi longgar supaya sales di dalam toko tetap kelihatan live.
      if (!force || fix.acc <= 200) setGps(fix);
      setGpsText(`Live · akurasi ±${fix.acc} m${document.hidden ? " · belakang" : ""}`);
      setWatching(true);
      const prev = lastPos.current;
      const moved = prev ? Math.hypot(fix.lat - prev.lat, fix.lng - prev.lng) : 1;
      const stale = Date.now() - lastSent.current > (nativeApp ? 8_000 : 12_000);
      const movedEnough = moved >= (nativeApp ? 0.00003 : 0.00005); // ~3–5 m
      // Utamakan titik akurat; network kasar di dalam toko tetap boleh lewat heartbeat.
      const accLimit = nativeApp ? 100 : document.hidden ? 160 : 80;
      if (force) {
        if (fix.acc > 220 && Date.now() - lastSent.current < 25_000) return;
      } else {
        if (fix.acc > accLimit) return;
        if (!stale && !movedEnough) return;
      }
      flushPing(fix);
    };

    async function holdWake() {
      try {
        wake = (await navigator.wakeLock?.request("screen")) || null;
      } catch {
        wake = null;
      }
    }

    void holdWake();
    void startFieldTrackingNotify({ nama: state.nama });
    // Native Android: service terpisah — GPS tetap kirim meski app di belakang.
    void startNativeBackgroundTrack(token);

    // Titik pertama segera saat app/link dibuka.
    void readNativeOrBrowserGps()
      .then((fix) => pushPing(fix, true))
      .catch(() => undefined);

    void watchNativeOrBrowserGps(
      (fix) => pushPing(fix),
      (message) => {
        setWatching(false);
        if (message) setPermHint(message);
      },
    ).then((handle) => {
      if (!alive) {
        handle.stop();
        return;
      }
      stopWatch = handle.stop;
      setWatching(true);
    });

    // Heartbeat: tetap kirim meski diam / di dalam toko.
    const forceTimer = window.setInterval(() => {
      void readNativeOrBrowserGps()
        .then((fix) => pushPing(fix, true))
        .catch(() => undefined);
      // Pastikan service native tidak mati diam-diam di OEM agresif.
      if (nativeApp) void startNativeBackgroundTrack(token);
    }, nativeApp ? 10_000 : 15_000);

    const softRefresh = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 90_000);

    function onVisibility() {
      const hidden = document.visibilityState !== "visible";
      setInBackground(hidden);
      void readNativeOrBrowserGps()
        .then((fix) => pushPing(fix, true))
        .catch(() => undefined);
      void startNativeBackgroundTrack(token);
      if (!hidden) {
        // Chrome dibuka lagi setelah swipe/RAM: nyalakan ulang pantauan di tab ini.
        setWatching(true);
        void holdWake();
        void startFieldTrackingNotify({ nama: state.nama });
        void watchNativeOrBrowserGps(
          (fix) => pushPing(fix),
          (message) => {
            setWatching(false);
            if (message) setPermHint(message);
          },
        ).then((handle) => {
          if (!alive) {
            handle.stop();
            return;
          }
          stopWatch?.();
          stopWatch = handle.stop;
          setWatching(true);
        });
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    window.addEventListener("focus", onVisibility);

    return () => {
      alive = false;
      stopWatch?.();
      window.clearInterval(forceTimer);
      window.clearInterval(softRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
      window.removeEventListener("focus", onVisibility);
      void wake?.release().catch(() => undefined);
      void stopFieldTrackingNotify();
      // Jangan stop native track di cleanup visibility — biarkan hidup di belakang.
      // Stop hanya saat checkout / jam 18.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.checkedOut, token, nativeApp, state.nama]);

  useEffect(() => {
    if (state.checkedOut) return;
    const tick = () => {
      if (isPastTrackingAutoClose()) void autoCloseDay();
    };
    tick();
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.checkedOut, token, gps]);

  async function onCheckin() {
    if (!photo) {
      setError("Ambil 1 foto dulu (kamera).");
      return;
    }
    setBusy("pagi");
    setError("");
    try {
      let fix = gps;
      if (!fix || fix.acc > 120) {
        setGpsText("Mengambil GPS akurat untuk absensi…");
        let best: GpsFix | null = fix;
        for (let i = 0; i < 4; i++) {
          const next = await readNativeOrBrowserGps();
          if (!best || next.acc < best.acc) best = next;
          if (best.acc <= 25) break;
          await new Promise((r) => setTimeout(r, 700));
        }
        if (!best) throw new Error("GPS gagal. Nyalakan lokasi HP.");
        fix = best;
        setGps(best);
      }
      await send("checkin_pagi", fix, photo);
      setPhotoFile(null);
      setError("");
      // Setelah absen: paksa GPS native hidup terus ke mana pun sales pergi.
      void startNativeBackgroundTrack(token);
      void startFieldTrackingNotify({ nama: state.nama });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal absensi pagi.");
    } finally {
      setBusy("");
    }
  }

  async function onVisit() {
    if (!gps) {
      setError("Tunggu GPS menyala dulu.");
      return;
    }
    setBusy("visit");
    setError("");
    try {
      await send("visit", gps, photo, note);
      setNote("");
      setPhotoFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan tempat nawar.");
    } finally {
      setBusy("");
    }
  }

  /** Dipakai auto-close jam 18:00 — tidak ada tombol manual. */
  async function autoCloseDay() {
    if (autoClosedRef.current || state.checkedOut) return;
    autoClosedRef.current = true;
    try {
      let fix = gps || lastPos.current;
      if (!fix) {
        try {
          fix = await readNativeOrBrowserGps();
        } catch {
          fix = null;
        }
      }
      if (fix) {
        try {
          await send("checkin_sore", fix);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (!/berhenti|18:00|CHECKOUT/i.test(msg)) throw err;
        }
      }
      setState((prev) => ({ ...prev, checkedOut: true }));
      setWatching(false);
      setGpsText(`GPS otomatis berhenti jam ${TRACKING_AUTO_CLOSE_HOUR}:00`);
      void stopFieldTrackingNotify();
      void stopNativeBackgroundTrack();
    } catch {
      autoClosedRef.current = false;
    }
  }

  async function onQris() {
    if (!qrisUrl) {
      setError("QRIS belum diunggah founder di Henima Tracking.");
      return;
    }
    if (!gps) {
      setError("Ambil lokasi GPS dulu, supaya tercatat sales mana yang menampilkan QRIS.");
      return;
    }
    setBusy("qris");
    setError("");
    try {
      await send("qris", gps);
      setShowQris(true);
      setQrisZoom(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencatat QRIS.");
    } finally {
      setBusy("");
    }
  }

  // Riwayat ringkas: tanpa ping, QRIS berurutan digabung.
  const visits = state.points
    .filter((p) => p.kind !== "ping")
    .filter((point, index, arr) => !(point.kind === "qris" && arr[index - 1]?.kind === "qris"));
  const light = embedded;
  const shell = light
    ? "min-h-[100dvh] touch-pan-y bg-[#F7F7F5] pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] text-[#111]"
    : "min-h-full touch-pan-y bg-[#08080f] pb-10 text-white";
  const card = light ? "rounded-2xl border border-[#E8E8E4] bg-white p-4" : "rounded-2xl border border-white/10 bg-white/[0.04] p-4";
  const sub = light ? "text-sm text-[#5C5C5C]" : "text-sm text-white/65";
  const tiny = light ? "text-xs text-[#6B6B6B]" : "text-xs text-white/55";
  const ghost = light
    ? "w-full rounded-2xl border border-[#E8E8E4] bg-[#F7F7F5] py-3.5 text-sm font-semibold text-[#111]"
    : "w-full rounded-2xl border border-white/15 bg-white/10 py-3.5 text-sm font-semibold text-white";
  const primary = "w-full rounded-2xl bg-[#111] py-3.5 text-sm font-semibold text-white disabled:opacity-40";
  const gold = "w-full rounded-2xl bg-[#B8952A] py-3.5 text-sm font-semibold text-white disabled:opacity-40";
  const live = watching && !state.checkedOut;

  return (
    <main className={shell}>
      <header
        className={
          light
            ? "sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#E8E8E4] bg-white/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] backdrop-blur"
            : "sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#08080f]/90 px-4 py-3 backdrop-blur"
        }
      >
        <div className="flex min-w-0 items-center gap-2">
          {onBack ? (
            <button type="button" onClick={onBack} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${light ? "border-[#E8E8E4]" : "border-white/15"}`}>
              Home
            </button>
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-bold">HENIMA GPS</p>
            <p className={`truncate ${tiny}`}>{state.nama}</p>
          </div>
        </div>
        <button type="button" onClick={() => void refresh().catch((err) => setError(err.message))} className={`shrink-0 ${tiny}`}>
          Muat ulang
        </button>
      </header>

      <div className="mx-auto max-w-md space-y-3 px-4 py-4">
        {/* 1 status besar — biar sales langsung paham */}
        <section
          className={
            state.checkedOut
              ? "rounded-2xl border border-[#E8D7A8] bg-[#FFF8E8] p-4"
              : live
                ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
                : "rounded-2xl border border-amber-200 bg-amber-50 p-4"
          }
        >
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                state.checkedOut ? "bg-[#B8952A]" : live ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <p className="text-base font-bold text-[#111]">
              {state.checkedOut
                ? `GPS berhenti · jam ${TRACKING_AUTO_CLOSE_HOUR}:00`
                : live
                  ? "GPS menyala"
                  : "Menyalakan GPS…"}
            </p>
          </div>
          <p className="mt-1 text-sm leading-snug text-[#444]">
            {state.checkedOut
              ? "Besok buka app lagi. GPS langsung jalan sendiri."
              : live
                ? nativeApp
                  ? `GPS jalan di belakang (seperti Grab). Auto stop jam ${TRACKING_AUTO_CLOSE_HOUR}:00. Jangan force-stop app.`
                  : `GPS aktif di Chrome. Auto stop jam ${TRACKING_AUTO_CLOSE_HOUR}:00.`
                : "Izinkan lokasi HP dulu."}
          </p>
          {!state.checkedOut ? <p className="mt-2 text-xs font-medium text-[#555]">{gpsText}</p> : null}
          {!nativeApp && !state.checkedOut ? (
            <p className="mt-3 rounded-xl border border-amber-300 bg-amber-100/80 px-3 py-2 text-xs leading-snug text-amber-950">
              Pakai <span className="font-semibold">app HENIMA Sales</span>, jangan Chrome saja. Kalau RAM dikosongkan / Chrome
              di-swipe, GPS di browser <span className="font-semibold">mati</span>. Di app, GPS bisa nyala lagi sendiri +
              notifikasi tetap ada.
            </p>
          ) : null}
          {nativeApp && !state.checkedOut ? (
            <button type="button" onClick={() => void openNativeLocationSettings()} className={`${ghost} mt-3`}>
              Izinkan lokasi selalu
            </button>
          ) : null}
        </section>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}

        {/* Absensi pagi — kartu besar, 1 langkah */}
        {!state.hasCheckinPagi && !state.checkedOut ? (
          <section className={card}>
            <p className="text-base font-bold">Absensi pagi</p>
            <p className={`mt-1 ${tiny}`}>Cuma 1 foto. GPS diambil otomatis.</p>
            <label className="mt-3 block">
              <span className="flex min-h-24 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-[#B8952A]/50 bg-[#FFF8E8] px-3 py-4 text-sm font-semibold text-[#111]">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Absensi" className="max-h-40 rounded-lg" />
                ) : (
                  "📷 Ketuk ambil foto"
                )}
              </span>
              <input
                type="file"
                accept="image/*,.heic,.heif"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  setPhotoFile(e.target.files?.[0] || null);
                  e.target.value = "";
                  void grabGps();
                }}
              />
            </label>
            <button
              type="button"
              disabled={!photo || busy === "pagi"}
              onClick={() => void onCheckin()}
              className={`${gold} mt-3`}
            >
              {busy === "pagi" ? "Mengirim…" : "Kirim absensi pagi"}
            </button>
          </section>
        ) : null}

        {/* Tombol utama: QRIS */}
        {qrisUrl ? (
          <section className={card}>
            <p className="text-base font-bold">Bayar QRIS</p>
            <p className={`mt-1 ${tiny}`}>Tunjukkan ke pembeli</p>
            {!state.checkedOut ? (
              <button type="button" disabled={busy === "qris"} onClick={() => void onQris()} className={`${gold} mt-3`}>
                {busy === "qris" ? "Menyiapkan…" : showQris ? "Tampilkan QRIS lagi" : "Tampilkan QRIS"}
              </button>
            ) : null}
            {(showQris || state.checkedOut) && (
              <button type="button" onClick={() => setQrisZoom(true)} className="mt-3 w-full overflow-hidden rounded-xl border border-[#E8E8E4] bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrisUrl} alt="QRIS" className="mx-auto max-h-56 w-full object-contain" />
                <p className="mt-2 text-center text-xs font-semibold text-[#111]">{state.nama} · ketuk perbesar</p>
              </button>
            )}
          </section>
        ) : null}

        {!state.checkedOut ? (
          <section className={`${card} space-y-2`}>
            <button type="button" onClick={() => setShowExtras((v) => !v)} className={ghost}>
              {showExtras ? "Tutup · catat toko" : "Catat toko (opsional)"}
            </button>
            {showExtras ? (
              <div className="space-y-2 rounded-xl border border-dashed border-[#E8E8E4] bg-[#FAFAF8] p-3">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nama toko / orang"
                  className="w-full rounded-xl border border-[#E8E8E4] bg-white px-3 py-3 text-sm outline-none"
                />
                <label className="block">
                  <span className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-[#E8E8E4] bg-white px-3 py-3 text-sm text-[#555]">
                    {preview && state.hasCheckinPagi ? "Foto toko siap · ganti?" : "Foto toko (opsional)"}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => {
                      setPhotoFile(e.target.files?.[0] || null);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button type="button" disabled={!gps || busy === "visit"} onClick={() => void onVisit()} className={primary}>
                  {busy === "visit" ? "Menyimpan…" : "Simpan catat toko"}
                </button>
              </div>
            ) : null}
            <button type="button" onClick={grabGps} className={ghost}>
              Segarkan GPS (lebih akurat)
            </button>
          </section>
        ) : null}

        {/* Riwayat disembunyikan default */}
        <section className={card}>
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="flex w-full items-center justify-between text-left">
            <span className="text-base font-bold text-[#111]">Riwayat hari ini</span>
            <span className={tiny}>{showHistory ? "Sembunyikan" : `${visits.length} catatan`}</span>
          </button>
          {showHistory ? (
            visits.length === 0 ? (
              <p className={`mt-3 ${sub}`}>Belum ada catatan.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {visits.slice(0, 8).map((point) => (
                  <li key={point.id} className="rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#111]">{KIND_LABEL[point.kind]}</span>
                      <span className="font-mono text-xs text-[#666]">{clock(point.recorded_at)}</span>
                    </div>
                    {point.note ? <p className="mt-1 text-xs text-[#555]">{point.note}</p> : null}
                    {point.photo_url && point.kind !== "qris" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={point.photo_url} alt="" className="mt-2 max-h-28 w-full rounded-lg object-cover" />
                    ) : null}
                    {point.late ? <p className="mt-1 text-xs font-medium text-rose-600">Lewat 09:00</p> : null}
                    <a
                      href={point.maps || mapsUrl(point.lat, point.lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-semibold text-[#0B57D0]"
                    >
                      Buka Maps
                    </a>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </section>
      </div>

      {qrisZoom && qrisUrl ? (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-black/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))]"
          role="dialog"
          aria-label="QRIS besar"
          onClick={() => setQrisZoom(false)}
        >
          <div className="flex items-center justify-between gap-3 pb-3 text-white" onClick={(event) => event.stopPropagation()}>
            <p className="min-w-0 truncate text-sm font-semibold">{state.nama} · QRIS</p>
            <button type="button" onClick={() => setQrisZoom(false)} className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold">
              Tutup
            </button>
          </div>
          <button
            type="button"
            className="flex min-h-0 flex-1 items-center justify-center"
            onClick={(event) => {
              event.stopPropagation();
              setQrisZoom(false);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrisUrl} alt="QRIS" className="max-h-full max-w-full object-contain" />
          </button>
        </div>
      ) : null}
    </main>
  );
}
