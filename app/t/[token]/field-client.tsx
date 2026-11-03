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
  checkin_pagi: "Check-in pagi",
  checkin_sore: "Check-in sore",
  visit: "Nawar di sini",
  ping: "Jejak",
  qris: "QRIS",
};

function clock(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function pesanDb(message: string) {
  if (message.includes("BELUM_CHECKIN")) return "Belum check-in. Jejak dan kunjungan belum bisa dicatat.";
  if (message.includes("SUDAH_CHECKOUT")) return "Sudah check-out. Hari ini tidak bisa check-in lagi.";
  if (message.includes("TIDAK_LOGIN")) return "Link ini belum aktif di database. Minta founder paste SQL field token.";
  if (message.includes("DATA_TIDAK_VALID")) return "Data tidak valid. Cek foto, GPS, atau apakah check-in hari ini sudah ada.";
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
  const lastSent = useRef(0);
  const lastPos = useRef<GpsFix | null>(null);
  const pingBusy = useRef(false);
  const pendingPing = useRef<GpsFix | null>(null);
  const pingFailStreak = useRef(0);
  const previewUrl = useRef("");

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
              : (
                  await supabase.rpc("henima_tracking_field_titik", {
                    p_token: token,
                    p_lat: useFix.lat,
                    p_lng: useFix.lng,
                    p_accuracy_m: accuracy,
                  })
                ).error;
    if (error) throw new Error(pesanDb(error.message));
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
        // Ambil 2–3 kali, pakai yang akurasinya terbaik.
        let best: { lat: number; lng: number; acc: number } | null = null;
        for (let i = 0; i < 3; i++) {
          const fix = await readNativeOrBrowserGps();
          if (!best || fix.acc < best.acc) best = fix;
          if (fix.acc <= 25) break;
          await new Promise((r) => setTimeout(r, 900));
        }
        if (!best) throw new Error("GPS kosong");
        setGps(best);
        setGpsText(`Lokasi didapat. Akurasi ±${best.acc} m${nativeApp ? " · app" : ""}`);
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
    // Life360: GPS jalan segera saat buka link/app — tanpa wajib check-in pagi.
    if (state.checkedOut) return;

    let alive = true;
    let wake: WakeLockSentinel | null = null;
    let stopWatch: (() => void) | null = null;

    const flushPing = (fix: GpsFix) => {
      if (!alive) return;
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
          pingFailStreak.current += 1;
          if (pingFailStreak.current <= 2 || pingFailStreak.current % 8 === 0) {
            const msg = err instanceof Error ? err.message : "Gagal kirim titik GPS.";
            setError(`GPS: ${msg}`);
            setGpsText(`Gagal kirim · ${msg}`);
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
      if (!alive) return;
      setGps(fix);
      setGpsText(`Live · akurasi ±${fix.acc} m · mengirim terus${document.hidden ? " · belakang" : ""}`);
      setWatching(true);
      const prev = lastPos.current;
      const moved = prev ? Math.hypot(fix.lat - prev.lat, fix.lng - prev.lng) : 1;
      // Mode Grab: native kirim ~8 dtk / pindah ~3 m. Force heartbeat selalu tembus.
      const stale = Date.now() - lastSent.current > (nativeApp ? 8_000 : 12_000);
      const movedEnough = moved >= (nativeApp ? 0.00003 : 0.00006);
      const accLimit = nativeApp ? 150 : document.hidden ? 450 : 300;
      if (!force && fix.acc > accLimit) return;
      if (!force && !stale && !movedEnough) return;
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

    // Heartbeat Grab-style: tetap kirim meski diam di satu titik.
    const forceTimer = window.setInterval(() => {
      void readNativeOrBrowserGps()
        .then((fix) => pushPing(fix, true))
        .catch(() => undefined);
    }, nativeApp ? 8_000 : 12_000);

    const softRefresh = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 90_000);

    function onVisibility() {
      const hidden = document.visibilityState !== "visible";
      setInBackground(hidden);
      void readNativeOrBrowserGps()
        .then((fix) => pushPing(fix, true))
        .catch(() => undefined);
      if (!hidden) {
        void holdWake();
        void startFieldTrackingNotify({ nama: state.nama });
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.checkedOut, token, nativeApp, state.nama]);

  async function onCheckin() {
    if (!gps || !photo) {
      setError("Ambil foto lokasi dan GPS dulu.");
      return;
    }
    setBusy("pagi");
    setError("");
    try {
      await send("checkin_pagi", gps, photo);
      setPhotoFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal check-in.");
    } finally {
      setBusy("");
    }
  }

  async function onVisit() {
    if (!gps) {
      setError("Ambil lokasi GPS dulu.");
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

  async function onSore() {
    if (!gps) {
      setError("Ambil lokasi GPS dulu.");
      return;
    }
    setBusy("sore");
    setError("");
    try {
      await send("checkin_sore", gps, photo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal check-in sore.");
    } finally {
      setBusy("");
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

  const visits = state.points.filter((p) => p.kind !== "ping");
  const light = embedded;
  const card = light
    ? "rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-sm"
    : "rounded-2xl border border-white/10 bg-white/[0.03] p-4";
  const muted = light ? "text-[#6B6B6B]" : "text-white/40";
  const soft = light ? "text-[#6B6B6B]" : "text-white/50";
  const label = light ? "text-[#8A8A8A]" : "text-white/35";
  const input = light
    ? "mt-3 w-full rounded-xl border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-3 text-sm outline-none"
    : "mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none";
  const ghostBtn = light
    ? "mt-3 w-full rounded-xl border border-[#E8E8E4] bg-[#F7F7F5] py-3 text-sm font-semibold"
    : "mt-3 w-full rounded-xl bg-white/10 py-3 text-sm";
  const primaryBtn = "mt-2 w-full rounded-xl bg-[#111111] py-3 text-sm font-semibold text-white disabled:opacity-40";
  const goldBtn = light
    ? "mt-2 w-full rounded-xl bg-[#B8952A] py-3 text-sm font-semibold text-white disabled:opacity-40"
    : "mt-2 w-full rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f59e0b] py-3 text-sm font-semibold text-[#08080f] disabled:opacity-40";
  void card; void muted; void soft; void label; void input; void ghostBtn; void primaryBtn; void goldBtn;

  return (
    <main
      className={
        light
          ? "min-h-full touch-pan-y bg-[#F7F7F5] pb-10 text-[#111111]"
          : "min-h-full touch-pan-y bg-[#08080f] pb-10 text-white"
      }
    >
      <header
        className={
          light
            ? "sticky top-0 z-10 flex items-center justify-between border-b border-[#E8E8E4] bg-white/95 px-4 py-3 backdrop-blur"
            : "sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#08080f]/90 px-4 py-3 backdrop-blur"
        }
      >
        <div className="flex items-center gap-2">
          {onBack && (
            <button type="button" onClick={onBack} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${light ? "border-[#E8E8E4]" : "border-white/15"}`}>
              Home
            </button>
          )}
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black ${light ? "bg-[#111] text-white" : "bg-white text-black"}`}>H</span>
          <div>
            <p className="text-sm font-bold">
              HENIMA <span className="text-[#B8952A]">GPS</span>
            </p>
            <p className={`text-[11px] ${light ? "text-[#6B6B6B]" : "text-white/45"}`}>{state.nama} · tanpa login</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh().catch((err) => setError(err.message))}
          className={`text-xs ${light ? "text-[#6B6B6B]" : "text-white/50"}`}
        >
          Muat ulang
        </button>
      </header>

      <div className={`mx-auto max-w-md space-y-4 px-4 py-5 ${light ? "pb-8" : ""}`}>
        <p
          className={
            light
              ? "rounded-xl border border-[#E8E8E4] bg-white px-3 py-2 text-center text-[12px] leading-5 text-[#6B6B6B]"
              : "rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-[12px] leading-5 text-white/65"
          }
        >
          Mode Life360: buka link/app → GPS langsung kirim titik terus. Tidak perlu check-in tiap pindah tempat.
        </p>
        {error && (
          <p
            className={
              light
                ? "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
                : "rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-200"
            }
          >
            {error}
          </p>
        )}

        {!state.checkedOut && (
          <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-sm font-semibold text-emerald-200">
              GPS live · tanpa check-in{nativeApp ? " · app" : ""}
            </p>
            <p className="mt-1 text-xs text-white/60">
              {watching
                ? "Titik dikirim otomatis ke peta owner kemanapun kamu bergerak."
                : "Menyalakan GPS… izinkan lokasi dulu."}
            </p>
            <p className="mt-2 text-center text-xs text-white/50">{gpsText}</p>
            {nativeApp && (
              <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-3 text-left">
                <p className="text-xs font-bold text-amber-100">Wajib: Izinkan selalu</p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-50/90">
                  Pilih <span className="font-semibold">Izinkan selalu</span> /{" "}
                  <span className="font-semibold">Allow all the time</span> supaya titik tetap muncul saat buka WhatsApp.
                </p>
                {permHint ? <p className="mt-2 text-[11px] text-amber-50/80">{permHint}</p> : null}
                <button
                  type="button"
                  onClick={() => void openNativeLocationSettings()}
                  className="mt-3 w-full rounded-xl border border-amber-200/40 bg-black/20 py-2.5 text-xs font-semibold text-amber-50"
                >
                  Buka pengaturan lokasi → Izinkan selalu
                </button>
              </div>
            )}
            <button type="button" onClick={grabGps} className="mt-3 w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white">
              Segarkan GPS sekarang
            </button>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] font-medium text-emerald-100/90">
              <li>Mode Grab: titik dikirim terus (~8 dtk) ke peta owner.</li>
              <li>Wajib Izinkan selalu + biarkan notifikasi GPS di status bar.</li>
              <li>Jangan swipe-close / force-stop app — itu yang bikin desk “Senyap”.</li>
              <li>Opsional: “Selesai kerja” kalau mau berhenti jejak hari ini.</li>
            </ul>
            {gps && (
              <p className="mt-2 text-[11px] font-medium text-emerald-100/80">
                Posisi live · akurasi ±{gps.acc} m{inBackground ? " · mode belakang" : ""}
              </p>
            )}
          </section>
        )}

        {!state.hasCheckinPagi && !state.checkedOut && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-center text-sm font-semibold">Foto absensi (opsional)</p>
            <p className="mt-1 text-center text-[11px] text-white/40">
              Boleh dilewati — GPS tetap jalan. iPhone: kamera / Galeri OK (otomatis jadi JPG).
            </p>
            <label className="mt-4 block">
              <span className="mb-2 block text-center text-[10px] font-bold tracking-widest text-white/35">FOTO</span>
              <span className="flex min-h-16 cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/30 px-3 py-4 text-sm text-white/70">
                {preview ? <img src={preview} alt="Foto lokasi" className="max-h-40 rounded-lg" /> : "Tap foto (opsional)"}
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
            <button
              type="button"
              disabled={!gps || !photo || busy === "pagi"}
              onClick={() => void onCheckin()}
              className="mt-2 w-full rounded-xl bg-white/10 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy === "pagi" ? "Menyimpan..." : "Kirim foto absensi"}
            </button>
          </section>
        )}

        {qrisUrl && (
          <section className="rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/10 p-4">
            <p className="text-sm font-semibold text-[#f5d98a]">Bayar QRIS</p>
            <p className="mt-1 text-[11px] text-white/60">
              {state.checkedOut
                ? "Sudah check-out. QRIS hari ini tidak dicatat lagi."
                : !state.checkedOut
                  ? `Tampilkan ke pelanggan. Tercatat di riwayat atas nama ${state.nama}.`
                  : "Sudah selesai kerja hari ini."}
            </p>
            {!state.checkedOut && (
              <>
                <button type="button" onClick={grabGps} className="mt-3 w-full rounded-xl bg-white/10 py-3 text-sm">
                  Ambil Lokasi GPS
                </button>
                <p className="mt-2 text-center text-xs text-white/50">{gpsText}</p>
                <button
                  type="button"
                  disabled={!gps || busy === "qris"}
                  onClick={() => void onQris()}
                  className="mt-2 w-full rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f59e0b] py-3 text-sm font-semibold text-[#08080f] disabled:opacity-40"
                >
                  {busy === "qris" ? "Menyimpan..." : showQris ? "Tampilkan lagi · catat riwayat" : "Tampilkan QRIS"}
                </button>
              </>
            )}
            {(showQris || (!state.checkedIn && !state.checkedOut)) && (
              <button
                type="button"
                onClick={() => setQrisZoom(true)}
                className="mt-3 w-full overflow-hidden rounded-xl bg-white p-3 text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrisUrl} alt="QRIS" className="mx-auto max-h-72 w-full object-contain" />
                <p className="mt-2 text-center text-xs font-semibold text-black">{state.nama} · QRIS</p>
                <p className="mt-1 text-center text-[11px] font-medium text-black/50">Ketuk untuk perbesar · tunjukkan ke pembeli</p>
              </button>
            )}
          </section>
        )}

        {!state.checkedOut && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold">Catat tempat (opsional)</p>
            <p className="mt-1 text-[11px] text-white/40">Tidak wajib. GPS sudah otomatis. Ini hanya kalau mau kasih nama toko.</p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Toko, kantor, atau nama orang"
              className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none"
            />
            <label className="mt-3 block">
              <span className="mb-2 block text-[10px] font-bold tracking-widest text-white/35">FOTO DOKUMENTASI</span>
              <span className="flex min-h-14 cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/30 px-3 py-3 text-sm text-white/70">
                {preview ? <img src={preview} alt="Dokumentasi nawar" className="max-h-36 rounded-lg" /> : "Tap untuk foto tempat nawar"}
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
            <p className="mt-3 text-center text-xs text-white/50">{gpsText}</p>
            <button type="button" onClick={grabGps} className="mt-2 w-full rounded-xl bg-white/10 py-3 text-sm">
              Ambil Lokasi GPS
            </button>
            <button
              type="button"
              disabled={!gps || busy === "visit"}
              onClick={() => void onVisit()}
              className="mt-2 w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold disabled:opacity-40"
            >
              {busy === "visit" ? "Menyimpan..." : "Saya nawar di sini"}
            </button>
          </section>
        )}

        {state.checkedOut && (
          <section className="rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/10 p-4 text-center">
            <p className="text-sm font-semibold text-[#d4af37]">Selesai kerja · GPS berhenti hari ini</p>
            <p className="mt-1 text-xs text-white/60">
              Jejak hari ini tetap di peta owner. Besok buka app lagi — GPS langsung jalan tanpa check-in.
            </p>
          </section>
        )}

        {!state.checkedOut && (
          <section className="rounded-2xl border border-white/10 p-4">
            <p className="text-sm font-semibold">Selesai kerja (opsional)</p>
            <p className="mt-1 text-[11px] text-white/40">
              Hanya kalau mau berhenti kirim GPS hari ini. Tidak wajib tiap pindah tempat.
            </p>
            <button type="button" onClick={grabGps} className="mt-3 w-full rounded-xl bg-white/10 py-3 text-sm">
              Ambil Lokasi GPS
            </button>
            <button
              type="button"
              disabled={!gps || busy === "sore"}
              onClick={() => void onSore()}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f59e0b] py-3 text-sm font-semibold text-[#08080f] disabled:opacity-40"
            >
              {busy === "sore" ? "Menyimpan..." : "Selesai kerja hari ini"}
            </button>
          </section>
        )}

        <section>
          <p className="mb-2 text-[10px] font-bold tracking-widest text-white/35">HARI INI</p>
          {visits.length === 0 ? (
            <p className="text-xs text-white/35">Belum ada titik.</p>
          ) : (
            <ul className="space-y-2">
              {visits.map((point) => (
                <li key={point.id} className="rounded-xl border border-white/10 px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>{KIND_LABEL[point.kind]}</span>
                    <span className="font-mono text-xs text-white/40">{clock(point.recorded_at)}</span>
                  </div>
                  {point.note && <p className="mt-1 text-xs text-white/60">{point.note}</p>}
                  {point.photo_url && point.kind !== "qris" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={point.photo_url} alt="" className="mt-2 max-h-40 w-full rounded-lg object-cover" />
                  )}
                  {point.kind === "qris" && (
                    <button type="button" onClick={() => qrisUrl && setQrisZoom(true)} className="mt-2 text-[11px] text-[#d4af37]">
                      Buka QRIS besar
                    </button>
                  )}
                  {point.late && <p className="mt-1 text-[11px] text-red-300">Lewat batas 09:00</p>}
                  <a href={point.maps || mapsUrl(point.lat, point.lng)} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-[#d4af37]">
                    Lihat di Maps
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {qrisZoom && qrisUrl && (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-black/95 p-4"
          role="dialog"
          aria-label="QRIS besar"
          onClick={() => setQrisZoom(false)}
        >
          <div className="flex items-center justify-between pb-3 text-white" onClick={(event) => event.stopPropagation()}>
            <p className="text-sm font-semibold">{state.nama} · QRIS</p>
            <button type="button" onClick={() => setQrisZoom(false)} className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold">
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
          <p className="pt-3 text-center text-xs text-white/60">Ketuk di mana saja untuk menutup</p>
        </div>
      )}
    </main>
  );
}
