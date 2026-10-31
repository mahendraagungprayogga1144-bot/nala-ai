"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapsUrl } from "@/lib/henima-tracking/shared";
import { isNativeApp, readNativeOrBrowserGps, watchNativeOrBrowserGps } from "@/lib/henima-tracking/native-geo";

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

export default function FieldClient({ token, initial }: { token: string; initial: FieldState }) {
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
  const [qrisUrl, setQrisUrl] = useState("");
  const [showQris, setShowQris] = useState(false);
  const [qrisZoom, setQrisZoom] = useState(false);
  const lastSent = useRef(0);
  const lastPos = useRef<GpsFix | null>(null);

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat jejak."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function refresh() {
    const response = await fetch(`/api/henima-tracking/field/${token}`, { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || "Gagal memuat jejak hari ini.");
    setState((prev) => ({
      ...prev,
      date: json.date || prev.date,
      points: (json.points || []) as FieldPoint[],
      checkedIn: Boolean(json.checkedIn),
      checkedOut: Boolean(json.checkedOut),
    }));
    setQrisUrl(typeof json.qrisUrl === "string" ? json.qrisUrl : "");
  }

  async function uploadPhoto(file: File) {
    const type = file.type || "image/jpeg";
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(type)) {
      throw new Error("Foto harus JPG, PNG, atau WEBP.");
    }
    if (file.size > 5 * 1024 * 1024) throw new Error("Foto maksimal 5MB.");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`/api/henima-tracking/field/${token}/photo`, { method: "POST", body: form });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || "Upload foto gagal.");
    return String(json.path);
  }

  async function send(kind: FieldPoint["kind"], fix: GpsFix, file?: File | null, place?: string) {
    if (fix.acc > 250 && kind !== "ping") {
      throw new Error("Sinyal GPS masih kasar. Ambil lokasi lagi di tempat terbuka.");
    }
    let photoPath: string | null = null;
    if (file) photoPath = await uploadPhoto(file);

    const supabase = createClient();
    const accuracy = Math.round(fix.acc);
    const error =
      kind === "checkin_pagi"
        ? (
            await supabase.rpc("henima_tracking_field_checkin", {
              p_token: token,
              p_lat: fix.lat,
              p_lng: fix.lng,
              p_accuracy_m: accuracy,
              p_photo_path: photoPath,
            })
          ).error
        : kind === "checkin_sore"
          ? (
              await supabase.rpc("henima_tracking_field_checkout", {
                p_token: token,
                p_lat: fix.lat,
                p_lng: fix.lng,
                p_accuracy_m: accuracy,
                p_photo_path: photoPath,
              })
            ).error
          : kind === "visit"
            ? (
                await supabase.rpc("henima_tracking_field_kunjungan", {
                  p_token: token,
                  p_lat: fix.lat,
                  p_lng: fix.lng,
                  p_accuracy_m: accuracy,
                  p_note: place || null,
                  p_photo_path: photoPath,
                })
              ).error
            : kind === "qris"
              ? (
                  await supabase.rpc("henima_tracking_field_qris", {
                    p_token: token,
                    p_lat: fix.lat,
                    p_lng: fix.lng,
                    p_accuracy_m: accuracy,
                  })
                ).error
              : (
                  await supabase.rpc("henima_tracking_field_titik", {
                    p_token: token,
                    p_lat: fix.lat,
                    p_lng: fix.lng,
                    p_accuracy_m: accuracy,
                  })
                ).error;
    if (error) throw new Error(pesanDb(error.message));
    await refresh();
    lastSent.current = Date.now();
    lastPos.current = fix;
  }

  useEffect(() => {
    void isNativeApp().then(setNativeApp);
  }, []);

  function grabGps() {
    setError("");
    setGpsText("Mengambil lokasi GPS...");
    void readNativeOrBrowserGps()
      .then((fix) => {
        setGps(fix);
        setGpsText(`Lokasi didapat. Akurasi ${fix.acc} m${nativeApp ? " · app" : ""}`);
      })
      .catch((err: unknown) => {
        const msg =
          err && typeof err === "object" && "code" in err && (err as { code: number }).code === 1
            ? "Izinkan akses lokasi di HP."
            : err instanceof Error && /timeout/i.test(err.message)
              ? "GPS timeout. Coba lagi di tempat terbuka."
              : "GPS gagal. Nyalakan lokasi.";
        setGpsText(msg);
        setError(msg);
      });
  }

  useEffect(() => {
    if (!state.checkedIn || state.checkedOut) return;

    let alive = true;
    let wake: WakeLockSentinel | null = null;
    let stopWatch: (() => void) | null = null;
    const trackUrl = typeof window !== "undefined" ? window.location.href : `/t/${token}`;

    const pushPing = (fix: GpsFix, force = false) => {
      if (!alive) return;
      setGps(fix);
      setWatching(true);
      const prev = lastPos.current;
      const moved = prev ? Math.hypot(fix.lat - prev.lat, fix.lng - prev.lng) : 1;
      const stale = Date.now() - lastSent.current > 45_000;
      const accLimit = document.hidden || nativeApp ? 250 : 180;
      if (!force && fix.acc > accLimit) return;
      if (!force && !stale && moved < 0.00022) return;
      void send("ping", fix).catch(() => undefined);
    };

    async function holdWake() {
      try {
        wake = (await navigator.wakeLock?.request("screen")) || null;
      } catch {
        wake = null;
      }
    }

    async function showTrackNotice() {
      if (nativeApp) return; // App native sudah punya notifikasi foreground service.
      try {
        if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
        if (Notification.permission === "default") await Notification.requestPermission();
        if (Notification.permission !== "granted") return;
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("Henima · auto track aktif", {
          body: "Boleh buka WhatsApp/app lain. Jangan tutup atau hapus tab ini sampai check-out.",
          tag: "henima-auto-track",
          requireInteraction: true,
          silent: true,
          data: { url: trackUrl },
        });
      } catch {
        /* ignore */
      }
    }

    async function clearTrackNotice() {
      try {
        if (!("serviceWorker" in navigator)) return;
        const reg = await navigator.serviceWorker.ready;
        const notes = await reg.getNotifications({ tag: "henima-auto-track" });
        notes.forEach((note) => note.close());
      } catch {
        /* ignore */
      }
    }

    void holdWake();
    void showTrackNotice();

    void watchNativeOrBrowserGps(
      (fix) => pushPing(fix),
      () => {
        if (!document.hidden) setWatching(false);
      },
    ).then((handle) => {
      if (!alive) {
        handle.stop();
        return;
      }
      stopWatch = handle.stop;
    });

    function onVisibility() {
      const hidden = document.visibilityState !== "visible";
      setInBackground(hidden);
      if (!hidden) {
        void readNativeOrBrowserGps()
          .then((fix) => pushPing(fix, true))
          .catch(() => undefined);
        void holdWake();
        void showTrackNotice();
        return;
      }
      void readNativeOrBrowserGps()
        .then((fix) => pushPing(fix, true))
        .catch(() => undefined);
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);

    return () => {
      alive = false;
      stopWatch?.();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
      void wake?.release().catch(() => undefined);
      void clearTrackNotice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.checkedIn, state.checkedOut, token, nativeApp]);

  async function onCheckin() {
    if (!gps || !photo) {
      setError("Ambil foto lokasi dan GPS dulu.");
      return;
    }
    setBusy("pagi");
    setError("");
    try {
      await send("checkin_pagi", gps, photo);
      setPhoto(null);
      setPreview("");
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
      setPhoto(null);
      setPreview("");
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

  return (
    <main className="min-h-screen bg-[#08080f] text-white">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#08080f]/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs font-black text-black">H</span>
          <div>
            <p className="text-sm font-bold">
              HENIMA <span className="text-[#d4af37]">Tracking</span>
            </p>
            <p className="text-[11px] text-white/45">
              {state.nama} · tanpa login
            </p>
          </div>
        </div>
        <button type="button" onClick={() => void refresh().catch((err) => setError(err.message))} className="text-xs text-white/50">
          Muat ulang
        </button>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 py-5">
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-[12px] leading-5 text-white/65">
          Buka link ini di HP, izinkan GPS, lalu check-in. Tidak perlu masuk akun Gercep.
        </p>
        {state.lateWindow && !state.checkedIn && (
          <p className="rounded-xl border border-red-500/30 bg-red-950/50 px-3 py-2 text-center text-xs text-red-200">
            Kamu telat check-in. Batas jam 09:00. Tetap lakukan check-in sekarang.
          </p>
        )}
        {error && <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-200">{error}</p>}

        {!state.checkedIn && !state.checkedOut && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-center text-sm font-semibold">Check-in pagi</p>
            <p className="mt-1 text-center text-[11px] text-white/40">Wajib sebelum jam 07:00. Batas jam 09:00.</p>
            <label className="mt-4 block">
              <span className="mb-2 block text-center text-[10px] font-bold tracking-widest text-white/35">FOTO LOKASI</span>
              <span className="flex min-h-16 cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/30 px-3 py-4 text-sm text-white/70">
                {preview ? <img src={preview} alt="Foto lokasi" className="max-h-40 rounded-lg" /> : "Tap untuk ambil foto"}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setPhoto(file);
                  setPreview(file ? URL.createObjectURL(file) : "");
                }}
              />
            </label>
            <p className="mt-4 text-center text-[10px] font-bold tracking-widest text-white/35">LOKASI GPS</p>
            <p className="mt-1 text-center text-xs text-white/50">{gpsText}</p>
            <button type="button" onClick={grabGps} className="mt-3 w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white">
              Ambil Lokasi GPS
            </button>
            <button
              type="button"
              disabled={!gps || !photo || busy === "pagi"}
              onClick={() => void onCheckin()}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f59e0b] py-3 text-sm font-semibold text-[#08080f] disabled:opacity-40"
            >
              {busy === "pagi" ? "Menyimpan..." : "Check-in pagi"}
            </button>
            <p className="mt-2 text-center text-[11px] text-white/45">
              {nativeApp
                ? "App Henima Sales: sekali check-in, GPS native ikut sampai check-out — boleh keluar app lain."
                : "Auto track: sekali check-in, lokasi ikut sampai check-out. Boleh keluar Chrome — jangan tutup tab. Lebih kuat pakai app Henima Sales."}
            </p>
          </section>
        )}

        {state.checkedIn && !state.checkedOut && (
          <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-sm font-semibold text-emerald-200">
              Auto track aktif{nativeApp ? " · app" : ""}
            </p>
            <p className="mt-1 text-xs text-white/60">
              {watching
                ? nativeApp
                  ? "GPS native aktif (bisa di belakang). Boleh buka WhatsApp/Maps. Berhenti setelah check-out."
                  : "Lokasi dikirim otomatis. Boleh buka app lain — tab Henima tetap di belakang."
                : "Izinkan GPS + notifikasi. Setelah check-in, tracking jalan sampai check-out."}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] font-medium text-emerald-100/90">
              {nativeApp ? (
                <>
                  <li>App boleh di belakang — tracking tetap jalan.</li>
                  <li>Jangan force-stop app dari pengaturan HP.</li>
                  <li>Berhenti hanya setelah check-out sore.</li>
                </>
              ) : (
                <>
                  <li>Boleh keluar dari Chrome ke aplikasi lain.</li>
                  <li>Jangan tutup / swipe hapus tab link ini.</li>
                  <li>Berhenti hanya setelah check-out sore.</li>
                </>
              )}
            </ul>
            {gps && (
              <p className="mt-2 text-[11px] font-medium text-emerald-100/80">
                Posisi live · akurasi ±{gps.acc} m{inBackground ? " · mode belakang" : ""}
                {gpsText ? ` · ${gpsText}` : ""}
              </p>
            )}
          </section>
        )}

        {qrisUrl && (
          <section className="rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/10 p-4">
            <p className="text-sm font-semibold text-[#f5d98a]">Bayar QRIS</p>
            <p className="mt-1 text-[11px] text-white/60">
              {state.checkedOut
                ? "Sudah check-out. QRIS hari ini tidak dicatat lagi."
                : state.checkedIn
                  ? `Tampilkan ke pelanggan. Tercatat di riwayat atas nama ${state.nama}.`
                  : "Check-in pagi dulu, baru QRIS bisa ditampilkan dan masuk riwayat."}
            </p>
            {state.checkedIn && !state.checkedOut && (
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

        {state.checkedIn && !state.checkedOut && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold">Nawar di sini</p>
            <p className="mt-1 text-[11px] text-white/40">Tap saat kamu sedang menawarkan, supaya tempatnya tercatat.</p>
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
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setPhoto(file);
                  setPreview(file ? URL.createObjectURL(file) : "");
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
            <p className="text-sm font-semibold text-[#d4af37]">Sudah check-out · auto track berhenti</p>
            <p className="mt-1 text-xs text-white/60">
              Posisi live tidak dikirim lagi. Jejak hari ini tetap ada di riwayat kantor. Check-in ulang baru besok.
            </p>
          </section>
        )}

        {state.checkedIn && !state.checkedOut && (
          <section className="rounded-2xl border border-white/10 p-4">
            <p className="text-sm font-semibold">Check-out sore</p>
            <p className="mt-1 text-[11px] text-white/40">
              Saat target hari selesai / pulang. Setelah check-out, auto track berhenti dan posisi live tidak muncul lagi.
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
              {busy === "sore" ? "Menyimpan..." : "Check-out"}
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
