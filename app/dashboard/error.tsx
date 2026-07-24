"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error?.message, error?.digest);
  }, [error]);

  const hint = (error?.message || "").slice(0, 180);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#EC4899]/30 bg-[#EC4899]/10">
        <AlertTriangle size={24} className="text-[#EC4899]" />
      </div>
      <h1 className="mb-2 text-lg font-semibold text-[#F0EFF8]">Halaman gagal dimuat</h1>
      <p className="mb-1 max-w-md text-sm text-[#8B8AA0]">
        Terjadi kesalahan di server. Coba muat ulang. Jika berulang, ganti bisnis aktif di sidebar lalu buka lagi.
      </p>
      {hint ? (
        <p className="mb-2 max-w-lg break-words font-mono text-[10px] text-[#EC4899]/80">{hint}</p>
      ) : null}
      {error?.digest && (
        <p className="mb-6 font-mono text-[10px] text-[#5A5B7A]">ERROR {error.digest}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}
        >
          Coba lagi
        </button>
        <a
          href="/dashboard/owner"
          className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-[#8B8AA0] hover:text-[#F0EFF8]"
        >
          Ke Owner
        </a>
        <a
          href="/dashboard/inventory"
          className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-[#8B8AA0] hover:text-[#F0EFF8]"
        >
          Ke Inventory
        </a>
      </div>
    </div>
  );
}
