"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock, X } from "lucide-react";

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Banner trial 5 hari / trial habis — tampil di dashboard mobile & desktop. */
export default function TrialBanner() {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const exp = readCookie("sub_expired") === "1";
    const left = Number(readCookie("trial_days_left"));
    setExpired(exp);
    if (!exp && Number.isFinite(left)) setDaysLeft(left);
  }, []);

  if (hidden) return null;
  if (!expired && daysLeft == null) return null;

  return (
    <div
      className={`relative z-40 border-b px-3 py-2.5 text-center text-[12px] sm:px-4 ${
        expired
          ? "border-[#EC4899]/25 bg-[#EC4899]/10 text-[#F9A8D4]"
          : "border-[#F59E0B]/25 bg-[#F59E0B]/10 text-[#FCD34D]"
      }`}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-center gap-2">
        <Clock size={14} className="shrink-0" />
        {expired ? (
          <p>
            Trial berakhir. Upgrade untuk lanjut pakai fitur penuh.{" "}
            <Link href="/dashboard/upgrade" className="font-semibold underline">
              Lihat paket →
            </Link>
          </p>
        ) : (
          <p>
            Trial aktif · sisa <strong>{daysLeft} hari</strong>.{" "}
            <Link href="/dashboard/upgrade" className="font-semibold underline">
              Upgrade sekarang
            </Link>
          </p>
        )}
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-60 hover:opacity-100"
          aria-label="Tutup"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
