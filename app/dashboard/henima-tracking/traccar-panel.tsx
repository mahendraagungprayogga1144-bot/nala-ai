"use client";

import { ExternalLink, Radar } from "lucide-react";

const GOLD = "#C5A358";

export default function TraccarPanel({ dashboardUrl }: { dashboardUrl: string }) {
  const ready = Boolean(dashboardUrl);

  return (
    <div className="flex h-full min-h-[70vh] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[#111] md:text-[26px]">Server GPS Traccar</h1>
          <p className="mt-0.5 max-w-2xl text-sm font-medium text-[#6B6B6B]">
            Pantau jejak dari server Traccar. Titik sales HENIMA ikut dikirim ke sini kalau forward aktif — akurasi
            tetap dari chip GPS HP (mode akurat).
          </p>
        </div>
        {ready ? (
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#111] bg-[#111] px-3 text-xs font-bold text-white"
          >
            Buka penuh
            <ExternalLink size={14} />
          </a>
        ) : null}
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
              <p className="font-bold text-[#111]">Traccar belum diarahkan ke dashboard ini</p>
              <p>
                Set env <code className="rounded bg-white px-1.5 py-0.5 text-xs">NEXT_PUBLIC_TRACCAR_URL</code> ke URL
                web Traccar (contoh lokal: <code className="rounded bg-white px-1.5 py-0.5 text-xs">http://127.0.0.1:8082</code>
                ).
              </p>
              <p>
                Untuk jejak sales ikut masuk Traccar, set juga{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs">TRACCAR_OSMAND_URL</code> (contoh:{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs">http://127.0.0.1:5055</code>).
              </p>
              <p className="text-xs text-[#6B6B6B]">
                Catatan: Traccar tidak membuat satelit lebih akurat. Yang membuat akurat adalah GPS native mode high
                accuracy + izin lokasi selalu di HP sales.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#E8E8E4] bg-white shadow-sm">
          <iframe
            title="Traccar GPS"
            src={dashboardUrl}
            className="h-[min(78vh,820px)] w-full border-0 bg-white"
            referrerPolicy="no-referrer"
            allow="geolocation"
          />
        </div>
      )}
    </div>
  );
}
