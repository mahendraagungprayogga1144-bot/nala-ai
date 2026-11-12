"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getHenimaSalesApkUrl, readRememberedFieldToken } from "@/lib/henima-tracking/field-app";
import { isNativeApp } from "@/lib/henima-tracking/native-geo";
import InstallToHome from "./install-to-home";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function isIosSafariHint() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua);
  // Chrome/CriOS di iPhone — GPS & PWA lebih lemah dari Safari.
  const chromeIos = /CriOS/i.test(ua);
  return ios && chromeIos;
}

/**
 * Pintu masuk app lapangan — tanpa link ke dashboard/login Gercep OS.
 */
export default function SalesAppHome({ apkUrl }: { apkUrl: string }) {
  const router = useRouter();
  const [native, setNative] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [chromeIos, setChromeIos] = useState(false);
  const [token, setToken] = useState("");
  const [last, setLast] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void isNativeApp().then(setNative);
    setStandalone(isStandaloneDisplay());
    setChromeIos(isIosSafariHint());
    setLast(readRememberedFieldToken());
  }, []);

  function openToken(raw: string) {
    const clean = raw.trim().toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(clean)) {
      setError("Token tidak valid. Paste link lengkap dari leader, atau 32 karakter hex.");
      return;
    }
    setError("");
    router.push(`/t/${clean}`);
  }

  function fromPasteLink() {
    const raw = token.trim();
    const match = raw.match(/\/t\/([a-f0-9]{32})/i);
    openToken(match?.[1] || raw);
  }

  const downloadUrl = apkUrl || getHenimaSalesApkUrl();

  return (
    <main className={`${jakarta.className} mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center px-5 py-10 text-[#111]`}>
      <h1 className="text-[15px] font-bold tracking-[0.08em]">HENIMA</h1>
      <p className="mt-2 text-sm text-[#6B6B6B]">
        {native
          ? "App khusus tracking & catat jual. Tidak membuka Gercep OS internal."
          : standalone
            ? "Paste link dari leader untuk buka portal sales."
            : "iPhone: pasang dari Safari. Android: APK. Lalu paste link dari leader."}
      </p>

      <section
        className="mt-5 flex items-end gap-3 overflow-hidden rounded-3xl border border-[#E8E8E4] bg-[#F7F4EE]"
        aria-label="Semangat tim"
      >
        <div className="relative h-[9.5rem] w-[7.25rem] shrink-0 overflow-hidden bg-[#F7F4EE]">
          <img
            src="/office-founder-calm.png"
            alt=""
            width={140}
            height={160}
            className="absolute inset-0 h-full w-full scale-[1.35] object-cover object-[50%_6%]"
            draggable={false}
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#F7F4EE]/0 via-transparent to-[#F7F4EE]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#F7F4EE] to-transparent"
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1 pb-4 pr-4 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B8952A]">Tim Henima</p>
          <p className="mt-1 text-[17px] font-bold leading-snug tracking-tight">Semangat hari ini.</p>
          <p className="mt-1.5 text-sm leading-relaxed text-[#4A4A4A]">
            Pasang app, paste link dari leader, langsung siap catat jual & tracking.
          </p>
        </div>
      </section>

      {chromeIos ? (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
          Di iPhone, pasang dari <span className="font-semibold">Safari</span> (bukan Chrome) supaya GPS & notif lebih
          stabil. Lalu paste link leader di bawah.
        </p>
      ) : null}

      <div className="mt-5">
        <InstallToHome apkUrl={downloadUrl} />
      </div>

      <div className="mt-6 space-y-3">
        {last ? (
          <button
            type="button"
            onClick={() => openToken(last)}
            className="w-full rounded-2xl bg-[#111] py-3.5 text-sm font-semibold text-white"
          >
            Lanjut sesi terakhir
          </button>
        ) : null}
        <label className="block text-xs font-semibold text-[#6B6B6B]">
          Paste link / token dari leader
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="https://…/t/… atau token"
            className="mt-1.5 w-full rounded-lg border border-[#E8E8E4] bg-white px-3 py-3 text-sm outline-none focus:border-[#B8952A]"
          />
        </label>
        <button
          type="button"
          onClick={fromPasteLink}
          className="w-full rounded-xl border border-[#E8E8E4] bg-white py-3 text-sm font-semibold"
        >
          Buka portal sales
        </button>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <p className="text-xs leading-relaxed text-[#8A8A8A]">
          Link dari leader = tombol <span className="font-semibold text-[#111]">Salin Link HP</span> di Tracking.
          Jangan login Gercep OS.
        </p>
      </div>
    </main>
  );
}
