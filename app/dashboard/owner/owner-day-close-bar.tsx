"use client";
import { useState } from "react";
import { FileSpreadsheet, FileText, MessageCircle, Moon } from "lucide-react";
import type { DayCloseData } from "@/app/dashboard/fnb/lib/day-close-report";
import { buildDayClosePdfHtml, buildDayCloseWhatsAppText, exportDayCloseExcel } from "@/app/dashboard/fnb/lib/day-close-report";
import { openWhatsAppShare } from "@/app/dashboard/fnb/lib/shift-report";
import InventoryPrintPreview from "@/app/dashboard/inventory/components/inventory-print-preview";

const BTN =
  "flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#0b0e14]/80 px-2 py-2 text-[10px] font-medium text-slate-400 transition-colors hover:border-[#2DD4BF]/35 hover:text-slate-200 sm:text-xs";

export default function OwnerDayCloseBar({ data }: { data: DayCloseData }) {
  const [preview, setPreview] = useState(false);

  if (data.kpis.totalOrders === 0) {
    return (
      <div className="mt-3 rounded-xl border border-white/[0.06] bg-[#0b0e14]/40 px-3 py-2.5 text-center text-[11px] text-slate-600">
        Belum ada order hari ini untuk rekap tutup hari.
      </div>
    );
  }

  return (
    <>
      <div className="mt-3 rounded-xl border border-[#A78BFA]/20 bg-[#A78BFA]/5 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Moon size={14} className="text-[#A78BFA]" />
          <p className="text-[11px] font-semibold text-[#A78BFA]">Rekap tutup hari</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN} onClick={() => exportDayCloseExcel(data)}>
            <FileSpreadsheet size={13} className="text-[#2DD4BF]" /> Excel
          </button>
          <button type="button" className={BTN} onClick={() => setPreview(true)}>
            <FileText size={13} className="text-[#A78BFA]" /> PDF
          </button>
          <button type="button" className={BTN} onClick={() => openWhatsAppShare(buildDayCloseWhatsAppText(data))}>
            <MessageCircle size={13} className="text-[#4ADE80]" /> WA
          </button>
        </div>
      </div>

      {preview && (
        <InventoryPrintPreview
          html={buildDayClosePdfHtml(data)}
          title={`Tutup hari · ${data.tanggal}`}
          onClose={() => setPreview(false)}
        />
      )}
    </>
  );
}
