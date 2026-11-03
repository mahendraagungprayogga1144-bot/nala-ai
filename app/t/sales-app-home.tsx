"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getHenimaSalesApkUrl, readRememberedFieldToken } from "@/lib/henima-tracking/field-app";
import { isNativeApp } from "@/lib/henima-tracking/native-geo";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/**
 * Pintu masuk app lapangan — tanpa link ke dashboard/login Gercep OS.
 */
export default function SalesAppHome({ apkUrl }: { apkUrl: string }) {
  const router = useRouter();
  const [native, setNative] = useState(false);
  const [token, setToken] = useState("");
  const [last, setLast] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void isNativeApp().then(setNative);
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
      <p className="text-[15px] font-bold tracking-[0.08em]">HENIMA</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Sales Lapangan</h1>
      <p className="mt-2 text-sm text-[#6B6B6B]">
        {native
          ? "App khusus tracking & catat jual. Tidak membuka Gercep OS internal."
          : "Pakai link dari leader, atau install app Android supaya GPS lebih kuat di belakang."}
      </p>

      {native ? (
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
              className="mt-1.5 w-full rounded-xl border border-[#E8E8E4] bg-white px-3 py-3 text-sm outline-none focus:border-[#B8952A]"
            />
          </label>
          <button
            type="button"
            onClick={fromPasteLink}
            className="w-full rounded-2xl border border-[#E8E8E4] bg-white py-3 text-sm font-semibold"
          >
            Buka portal sales
          </button>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="rounded-2xl border border-[#E8E8E4] bg-white px-4 py-3 text-sm text-[#6B6B6B]">
            Minta <span className="font-semibold text-[#111]">link HP</span> ke leader (tombol Salin Link HP di
            Tracking). Jangan pakai login Gercep OS.
          </p>
          {downloadUrl ? (
            <a
              href={downloadUrl}
              className="flex w-full items-center justify-center rounded-2xl bg-[#111] py-3.5 text-sm font-semibold text-white"
            >
              Unduh app Android Henima Sales
            </a>
          ) : (
            <p className="text-xs text-[#8A8A8A]">
              App Android: minta file APK ke leader (belum ada link unduhan publik).
            </p>
          )}
        </div>
      )}
    </main>
  );
}
