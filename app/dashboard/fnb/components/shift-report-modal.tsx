"use client";
import { Printer, MessageCircle, Check } from "lucide-react";
import { buildShiftReportHtml, buildShiftWhatsAppText, openWhatsAppShare, type ShiftReportData } from "../lib/shift-report";
import InventoryPrintPreview from "@/app/dashboard/inventory/components/inventory-print-preview";
import { useState } from "react";

export default function ShiftReportModal({
  data,
  onClose,
  onConfirm,
}: {
  data: ShiftReportData;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [preview, setPreview] = useState(false);

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-end justify-center bg-[#050508]/85 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div className="w-full max-w-md rounded-t-3xl border border-[#A78BFA]/30 bg-[#1A1A28] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#A78BFA]">Laporan shift</p>
          <h3 className="mb-1 text-base font-semibold text-[#FAFAFE]">{data.kasirName}</h3>
          <p className="mb-4 text-xs text-[#8B8AA0]">{data.tanggal} · {data.jamMasuk} – {data.jamKeluar} WIB</p>

          <div className="mb-4 grid grid-cols-3 gap-2">
            {[
              { l: "Order", v: String(data.totalOrders), c: "#A78BFA" },
              { l: "Omzet", v: "Rp" + data.omzet.toLocaleString("id-ID"), c: "#2DD4BF" },
              { l: "Laba", v: "Rp" + Math.round(data.laba).toLocaleString("id-ID"), c: "#FBBF24" },
            ].map(k => (
              <div key={k.l} className="rounded-xl border border-white/10 bg-[#0A0A14]/80 px-2 py-2 text-center">
                <p className="text-[9px] uppercase text-[#8B8AA0]">{k.l}</p>
                <p className="mt-0.5 font-mono text-[11px] font-bold sm:text-xs" style={{ color: k.c }}>{k.v}</p>
              </div>
            ))}
          </div>

          {data.orders.length > 0 && (
            <div className="mb-4 max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-[#0A0A14]/60 p-3">
              {data.orders.map((o, i) => (
                <div key={o.id} className="flex justify-between gap-2 border-b border-white/5 py-1.5 text-[11px] last:border-0">
                  <span className="min-w-0 truncate text-[#C4C3D4]">{i + 1}. {o.itemsSummary}</span>
                  <span className="shrink-0 font-mono text-[#2DD4BF]">Rp{o.total.toLocaleString("id-ID")}</span>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setPreview(true)}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs font-medium text-[#A8A7C0] hover:border-[#2DD4BF]/30"
          >
            <Printer size={14} className="text-[#2DD4BF]" /> Cetak laporan shift
          </button>
          <button
            type="button"
            onClick={() => openWhatsAppShare(buildShiftWhatsAppText(data))}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/30 bg-[#25D366]/10 py-2.5 text-xs font-medium text-[#4ADE80]"
          >
            <MessageCircle size={14} /> Kirim ke WhatsApp
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, #F472B6, #8B5CF6)", color: "#050508" }}
          >
            <Check size={16} /> Selesai check-out
          </button>
          <button type="button" onClick={onClose} className="mt-2 w-full py-2 text-xs text-[#8B8AA0]">Batal</button>
        </div>
      </div>

      {preview && (
        <InventoryPrintPreview
          html={buildShiftReportHtml(data)}
          title="Laporan Shift"
          onClose={() => setPreview(false)}
        />
      )}
    </>
  );
}
