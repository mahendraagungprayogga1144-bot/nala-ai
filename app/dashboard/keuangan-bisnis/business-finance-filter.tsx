"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { bizTypeLabel } from "@/lib/finance/biz-type-label";

export type FinanceBizOption = { id: string; name: string; type: string | null };

export default function BusinessFinanceFilter({
  businesses,
  selected,
}: {
  businesses: FinanceBizOption[];
  selected: string; // "all" | uuid
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (businesses.length === 0) return null;

  const setBisnis = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "all") next.set("bisnis", "all");
    else next.set("bisnis", value);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0F0F1A] px-3 py-2">
        <span className="shrink-0 text-xs text-[#8B8AA0]">Bisnis</span>
        <select
          value={selected}
          onChange={(e) => setBisnis(e.target.value)}
          className="max-w-[min(100%,280px)] cursor-pointer bg-transparent text-sm text-[#F2F1F8] focus:outline-none"
        >
          {businesses.length > 1 && (
            <option value="all" className="bg-[#0F0F1A]">
              Semua bisnis ({businesses.length})
            </option>
          )}
          {businesses.map((b) => (
            <option key={b.id} value={b.id} className="bg-[#0F0F1A]">
              {b.name} · {bizTypeLabel(b.type)}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-[#8B8AA0]">
        {selected === "all"
          ? "Rekapan digabung dari semua bisnis — tiap baris bertanda nama bisnis."
          : "Hanya transaksi bisnis ini. Ganti ke Semua untuk lihat gabungan."}
      </p>
    </div>
  );
}
