"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Radar } from "lucide-react";

const GOLD = "#C5A358";

function isLocalHttp(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const local = host === "127.0.0.1" || host === "localhost" || host === "::1";
    return local && u.protocol === "http:";
  } catch {
    return false;
  }
}

export default function TraccarPanel({ dashboardUrl }: { dashboardUrl: string }) {
  const ready = Boolean(dashboardUrl);
  const [pageHttps, setPageHttps] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);

  useEffect(() => {
    setPageHttps(window.location.protocol === "https:");
  }, []);

  const blockEmbed = useMemo(() => {
    if (!ready) return false;
    // Browser blokir mixed content: https induk + http iframe lokal → putih.
    if (pageHttps && isLocalHttp(dashboardUrl)) return true;
    return iframeFailed;
  }, [ready, pageHttps, dashboardUrl, iframeFailed]);

  return (
    <div className="flex h-full min-h-[70vh] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[#111] md:text-[26px]">Server GPS Traccar</h1>
          <p className="mt-0.5 max-w-2xl text-sm font-medium text-[#6B6B6B]">
            Pantau jejak dari server Traccar. Titik sales HENIMA ikut dikirim ke sini kalau forward aktif.
          </p>
        </div>
        {ready ? (
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#111] bg-[#111] px-3 text-xs font-bold text-white"
          >
            Buka Traccar
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
              <p className="font-bold text-[#111]">Traccar belum diarahkan</p>
              <p>
                Set <code className="rounded bg-white px-1.5 py-0.5 text-xs">NEXT_PUBLIC_TRACCAR_URL</code> (lokal:{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs">http://127.0.0.1:8082</code>).
              </p>
            </div>
          </div>
        </section>
      ) : blockEmbed ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-base font-bold text-[#111]">Panel tidak bisa digabung di sini (bukan error GPS)</p>
          <p className="mt-2 text-sm leading-relaxed text-[#444]">
            Situs HENIMA pakai <strong>https</strong>, sementara Traccar lokal pakai{" "}
            <code className="rounded bg-white px-1.5 py-0.5 text-xs">http://127.0.0.1:8082</code>. Browser memblokir itu
            → layar putih. Buka Traccar di tab baru.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[#444]">
            <li>
              Pastikan Traccar jalan di laptop:{" "}
              <code className="rounded bg-white px-1.5 py-0.5 text-xs">~/Projects/traccar-server/start.sh</code>
            </li>
            <li>Klik tombol di bawah</li>
          </ol>
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#111] px-4 text-sm font-bold text-white"
          >
            Buka http://127.0.0.1:8082
            <ExternalLink size={16} />
          </a>
          <p className="mt-3 text-xs text-[#6B6B6B]">
            GPS sales tetap di peta HENIMA (menu Lokasi GPS). Traccar opsional untuk pantau terpisah.
          </p>
        </section>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#E8E8E4] bg-white shadow-sm">
          <iframe
            title="Traccar GPS"
            src={dashboardUrl}
            className="h-[min(78vh,820px)] w-full border-0 bg-white"
            referrerPolicy="no-referrer"
            allow="geolocation"
            onError={() => setIframeFailed(true)}
            onLoad={(e) => {
              // Banyak browser: iframe gagal mixed-content tetap "load" kosong.
              try {
                const doc = (e.target as HTMLIFrameElement).contentDocument;
                if (doc && doc.location.href === "about:blank") setIframeFailed(true);
              } catch {
                /* cross-origin OK */
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
