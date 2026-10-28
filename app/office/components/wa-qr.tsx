"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function waMeLink(pageUrl: string) {
  return `https://wa.me/?text=${encodeURIComponent(pageUrl)}`;
}

export default function WaQr({ url }: { url: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let cancel = false;
    void QRCode.toDataURL(url, {
      margin: 2,
      width: 360,
      errorCorrectionLevel: "H",
      color: { dark: "#111111", light: "#FFFFFF" },
    }).then((image) => {
      if (!cancel) setSrc(image);
    });
    return () => {
      cancel = true;
    };
  }, [url]);

  if (!src) return <p className="text-[11px] text-slate-500">Menyiapkan kode QR…</p>;

  return (
    <div className="space-y-2">
      <img src={src} alt="Kode QR tautan balasan WhatsApp" className="mx-auto h-40 w-40 rounded-lg bg-white p-2" />
      <div className="flex flex-wrap gap-2">
        <a href={src} download="qr-wa-henima.png" className="rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-[#052e16]">
          Unduh QR
        </a>
        <a
          href={waMeLink(url)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-[#25D366]/40 px-3 py-2 text-xs font-semibold text-[#25D366]"
        >
          Buka di WhatsApp
        </a>
      </div>
    </div>
  );
}
