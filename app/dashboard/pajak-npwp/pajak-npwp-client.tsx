"use client";
import { useState } from "react";
import { FileText, Home, Calculator, ClipboardList, History } from "lucide-react";
import type { NpwpProfile, PajakRecord, OmzetBulanan } from "./page";
import PajakBeranda from "./components/pajak-beranda";
import PajakKalkulator from "./components/pajak-kalkulator";
import PajakLaporan from "./components/pajak-laporan";
import PajakRiwayat from "./components/pajak-riwayat";

const TABS = [
  { id: "beranda", label: "Beranda", icon: Home },
  { id: "kalkulator", label: "Kalkulator", icon: Calculator },
  { id: "laporan", label: "Laporan", icon: ClipboardList },
  { id: "riwayat", label: "Riwayat", icon: History },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function PajakNpwpClient({
  userId, tahun, npwp, pajakRecords, omzetPerBulan, totalPemasukan, totalPengeluaran,
}: {
  userId: string; tahun: number;
  npwp: NpwpProfile | null; pajakRecords: PajakRecord[];
  omzetPerBulan: OmzetBulanan[]; totalPemasukan: number; totalPengeluaran: number;
}) {
  const [tab, setTab] = useState<TabId>("beranda");

  const thisYearRecords = pajakRecords.filter(r => r.tahun === tahun);
  const totalPphTerutang = thisYearRecords.reduce((s, r) => s + Number(r.pph_terutang), 0);
  const totalPphDibayar = thisYearRecords.reduce((s, r) => s + Number(r.pph_dibayar), 0);
  const omzetTahunIni = totalPemasukan;

  return (
    <div className="w-full min-w-0 px-3 py-3 sm:px-8 sm:py-6 pb-12" style={{ background: "#070711" }}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <FileText size={24} className="text-[#2DD4BF]" />
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Pajak NPWP Center</h1>
          <p className="text-xs text-[#8B8AA0]">Kelola data NPWP dan laporan pajak usaha kamu</p>
        </div>
        <span className="rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-2 py-0.5 text-[10px] font-medium text-[#F59E0B]">Beta</span>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] p-1 scrollbar-none" style={{ background: "#0D0D1A" }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={"flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors " +
                (active ? "bg-[#2DD4BF]/15 text-[#2DD4BF]" : "text-[#5A5B7A] hover:text-[#8B8AA0]")}>
              <t.icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "beranda" && (
        <PajakBeranda
          npwp={npwp} tahun={tahun} omzetTahunIni={omzetTahunIni}
          totalPphTerutang={totalPphTerutang} totalPphDibayar={totalPphDibayar}
          omzetPerBulan={omzetPerBulan}
        />
      )}
      {tab === "kalkulator" && (
        <PajakKalkulator tahun={tahun} omzetPerBulan={omzetPerBulan} omzetTahunIni={omzetTahunIni} />
      )}
      {tab === "laporan" && (
        <PajakLaporan tahun={tahun} totalPemasukan={totalPemasukan} totalPengeluaran={totalPengeluaran} omzetTahunIni={omzetTahunIni} />
      )}
      {tab === "riwayat" && (
        <PajakRiwayat userId={userId} npwp={npwp} pajakRecords={pajakRecords} tahun={tahun} />
      )}
    </div>
  );
}
