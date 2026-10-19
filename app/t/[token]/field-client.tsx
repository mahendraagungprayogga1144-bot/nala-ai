"use client";

import { useEffect, useRef, useState } from "react";

export type FieldPoint = {
  id: string;
  kind: "checkin_pagi" | "checkin_sore" | "visit" | "ping";
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
};

function clock(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
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
  const lastSent = useRef(0);
  const lastPos = useRef<GpsFix | null>(null);

  async function refresh() {
    const res = await fetch(`/api/henima-tracking/public/${token}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gagal memuat.");
    setState(data);
  }

  async function send(kind: FieldPoint["kind"], fix: GpsFix, file?: File | null, place?: string) {
    const body = new FormData();
    body.set("kind", kind);
    body.set("lat", String(fix.lat));
    body.set("lng", String(fix.lng));
    body.set("accuracy", String(fix.acc));
    if (place) body.set("note", place);
    if (file) body.set("photo", file);
    const res = await fetch(`/api/henima-tracking/public/${token}`, { method: "POST", body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gagal menyimpan.");
    if (!data.skipped) setState(data);
    lastSent.current = Date.now();
    lastPos.current = fix;
  }

  function grabGps() {
    setError("");
    setGpsText("Mengambil lokasi GPS...");
    if (!navigator.geolocation) {
      setGpsText("GPS tidak tersedia di perangkat ini.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: Math.round(pos.coords.accuracy),
        };
        setGps(fix);
        setGpsText(`Lokasi didapat. Akurasi ${fix.acc} m`);
      },
      (err) => {
        const msg =
          err.code === 1
            ? "Izinkan akses lokasi di HP."
            : err.code === 3
              ? "GPS timeout. Coba lagi di tempat terbuka."
              : "GPS gagal. Nyalakan lokasi.";
        setGpsText(msg);
        setError(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  useEffect(() => {
    if (!state.checkedIn || state.checkedOut) return;
    if (!navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: Math.round(pos.coords.accuracy),
        };
        setGps(fix);
        setWatching(true);
        const prev = lastPos.current;
        const moved = prev ? Math.hypot(fix.lat - prev.lat, fix.lng - prev.lng) : 1;
        const stale = Date.now() - lastSent.current > 90_000;
        if (fix.acc > 80) return;
        if (!stale && moved < 0.0004) return;
        void send("ping", fix).catch(() => undefined);
      },
      () => setWatching(false),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
    // send closes over token only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.checkedIn, state.checkedOut, token]);

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
              {state.nama} · {state.role}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => void refresh().catch((err) => setError(err.message))} className="text-xs text-white/50">
          Muat ulang
        </button>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 py-5">
        {state.lateWindow && !state.checkedIn && (
          <p className="rounded-xl border border-red-500/30 bg-red-950/50 px-3 py-2 text-center text-xs text-red-200">
            Kamu telat check-in. Batas jam 09:00. Tetap lakukan check-in sekarang.
          </p>
        )}
        {error && <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-200">{error}</p>}

        {!state.checkedIn && (
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
          </section>
        )}

        {state.checkedIn && !state.checkedOut && (
          <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-sm font-semibold text-emerald-200">Jejak aktif</p>
            <p className="mt-1 text-xs text-white/60">
              {watching
                ? "Halaman ini terbuka, lokasi ikut tercatat otomatis. Jangan ditutup saat di jalan."
                : "Izinkan GPS dan biarkan halaman ini terbuka supaya kantor tahu kamu kemana."}
            </p>
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
            <p className="text-sm font-semibold text-[#d4af37]">Sudah check-out</p>
            <p className="mt-1 text-xs text-white/60">Hari ini tidak bisa check-in lagi. Jejak dan dokumentasi tetap tersimpan.</p>
          </section>
        )}

        {state.checkedIn && !state.checkedOut && (
          <section className="rounded-2xl border border-white/10 p-4">
            <p className="text-sm font-semibold">Check-in sore</p>
            <p className="mt-1 text-[11px] text-white/40">Saat pulang. Setelah check-out, hari ini tidak bisa check-in lagi.</p>
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
                  {point.late && <p className="mt-1 text-[11px] text-red-300">Lewat batas 09:00</p>}
                  <a href={point.maps} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-[#d4af37]">
                    Lihat di Maps
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
