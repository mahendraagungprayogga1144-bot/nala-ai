"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function MonthYearFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const now = new Date();
  const currentMonth = Number(searchParams.get("bulan")) || now.getMonth() + 1;
  const currentYear = Number(searchParams.get("tahun")) || now.getFullYear();

  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const handleChange = (bulan: number, tahun: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("bulan", String(bulan));
    next.set("tahun", String(tahun));
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex items-center gap-2 mb-6">
      <div className="flex items-center gap-2 bg-[#0F0F1A] border border-white/10 rounded-xl px-3 py-2">
        <span className="text-xs text-[#8B8AA0]">Rekap</span>
        <select
          value={currentMonth}
          onChange={(e) => handleChange(Number(e.target.value), currentYear)}
          className="bg-transparent text-sm text-[#F2F1F8] focus:outline-none cursor-pointer"
        >
          {months.map((m, i) => (
            <option key={i + 1} value={i + 1} className="bg-[#0F0F1A]">{m}</option>
          ))}
        </select>
        <select
          value={currentYear}
          onChange={(e) => handleChange(currentMonth, Number(e.target.value))}
          className="bg-transparent text-sm text-[#F2F1F8] focus:outline-none cursor-pointer"
        >
          {years.map((y) => (
            <option key={y} value={y} className="bg-[#0F0F1A]">{y}</option>
          ))}
        </select>
      </div>
      <span className="text-xs text-[#8B8AA0]">— menampilkan transaksi & grafik bulan ini</span>
    </div>
  );
}
