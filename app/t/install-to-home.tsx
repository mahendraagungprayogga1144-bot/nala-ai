"use client";

import { useEffect, useState } from "react";
import { Share, Smartphone } from "lucide-react";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

/**
 * Panduan “unduh” ke layar utama iPhone (PWA).
 * iOS tidak bisa auto-install — wajib Share → Tambah ke Layar Utama.
 */
export default function InstallToHome({ apkUrl = "" }: { apkUrl?: string }) {
  const [mode, setMode] = useState<"loading" | "installed" | "ios" | "android" | "other">("loading");

  useEffect(() => {
    if (isStandalone()) {
      setMode("installed");
      return;
    }
    if (isIos()) setMode("ios");
    else if (isAndroid()) setMode("android");
    else setMode("other");
  }, []);

  if (mode === "loading") return null;

  if (mode === "installed") {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        App sudah terpasang di layar utama. Buka dari ikon HP supaya GPS & notif jalan.
      </p>
    );
  }

  if (mode === "ios") {
    return (
      <section className="rounded-xl border border-[#E8E8E4] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(17,17,17,0.04)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#111] text-white">
            <Smartphone size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-[#111]">Pasang di iPhone</p>
            <p className="mt-1 text-xs leading-relaxed text-[#6B6B6B]">
              Tidak ada APK di iPhone. Pasang dari Safari supaya ikon muncul di layar utama & App Library.
            </p>
          </div>
        </div>
        <ol className="mt-3 space-y-2 text-sm text-[#111]">
          <li className="flex gap-2">
            <span className="font-bold text-[#B8952A]">1.</span>
            Buka link ini di <span className="font-semibold">Safari</span> (bukan Chrome).
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-[#B8952A]">2.</span>
            Tap <Share size={14} className="inline align-text-bottom text-[#007AFF]" />{" "}
            <span className="font-semibold">Bagikan</span> di bawah.
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-[#B8952A]">3.</span>
            Pilih <span className="font-semibold">Tambah ke Layar Utama</span> → Tambah.
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-[#B8952A]">4.</span>
            Buka ikon <span className="font-semibold">HENIMA</span> → izinkan Lokasi Selalu + Notifikasi.
          </li>
        </ol>
      </section>
    );
  }

  if (mode === "android") {
    return (
      <section className="rounded-xl border border-[#E8E8E4] bg-white px-4 py-4">
        <p className="text-sm font-bold text-[#111]">Android</p>
        <p className="mt-1 text-xs text-[#6B6B6B]">
          Lebih kuat pakai APK native. Atau di Chrome: menu ⋮ → <span className="font-semibold">Install app / Tambahkan ke layar utama</span>.
        </p>
        {apkUrl ? (
          <a
            href={apkUrl}
            className="mt-3 flex w-full items-center justify-center rounded-2xl bg-[#111] py-3 text-sm font-semibold text-white"
          >
            Unduh APK
          </a>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#E8E8E4] bg-white px-4 py-3 text-sm text-[#6B6B6B]">
      Di iPhone: buka Safari → Bagikan → Tambah ke Layar Utama. Di Android: install APK atau Install app dari Chrome.
    </section>
  );
}
