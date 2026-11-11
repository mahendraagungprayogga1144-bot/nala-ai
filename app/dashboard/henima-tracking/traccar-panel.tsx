"use client";

import { ExternalLink, Radar } from "lucide-react";

const GOLD = "#C5A358";

export default function TraccarPanel({ dashboardUrl }: { dashboardUrl: string }) {
  const ready = Boolean(dashboardUrl);

  return (
    <div className="flex h-full min-h-[50vh] flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-[#111] md:text-[26px]">Server GPS Traccar</h1>
        <p className="mt-0.5 max-w-2xl text-sm font-medium text-[#6B6B6B]">
          Traccar tidak ditampilkan di dalam kotak ini (biar tidak putih). Buka di tab baru.
        </p>
      </div>

      {!ready ? (
        <section className="rounded-2xl border border-[#E8E8E4] bg-[#FAFAF8] p-5">
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E8E8E4] bg-white"
              style={{ color: GOLD }}
            >
              <Radar size={18} />
            </span>
            <div className="min-w-0 space-y-2 text-sm text-[#444]">
              <p className="font-bold text-[#111]">Belum ada URL Traccar</p>
              <p>
                Set <code className="rounded bg-white px-1.5 py-0.5 text-xs">NEXT_PUBLIC_TRACCAR_URL</code> di env.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-[#E8E8E4] bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E8E8E4] bg-[#F7F4EC]"
              style={{ color: GOLD }}
            >
              <Radar size={18} />
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-base font-bold text-[#111]">Kenapa kosong / putih?</p>
                <p className="mt-1 text-sm leading-relaxed text-[#555]">
                  HENIMA di <strong>https://gercepos.id</strong> tidak boleh menanam halaman{" "}
                  <code className="rounded bg-[#F7F7F5] px-1.5 py-0.5 text-xs">{dashboardUrl}</code> di dalamnya.
                  Browser memblokir — bukan bug GPS.
                </p>
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-[#444]">
                <li>
                  Nyalakan Traccar:{" "}
                  <code className="rounded bg-[#F7F7F5] px-1.5 py-0.5 text-xs">
                    ~/Projects/traccar-server/start.sh
                  </code>
                </li>
                <li>Klik tombol di bawah</li>
                <li>
                  Jejak sales utama: menu <strong>Lokasi GPS</strong>
                </li>
              </ol>
              <a
                href={dashboardUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#111] px-4 text-sm font-bold text-white"
              >
                Buka Traccar di tab baru
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
