"use client";
import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import type { KasirExportContext, KasirExportOrder } from "../lib/kasir-export-types";
import { computeKasirKpis, exportKasirExcel, exportKasirPdfHtml } from "../lib/kasir-export";
import InventoryPrintPreview from "@/app/dashboard/inventory/components/inventory-print-preview";

const BTN =
  "flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#13131F]/90 px-3 py-2 text-[10px] font-medium text-[#A8A7C0] transition-colors hover:border-[#2DD4BF]/35 hover:text-[#FAFAFE] active:scale-[0.98] sm:text-xs";

export default function KasirExportBar({
  orders,
  ctx,
}: {
  orders: KasirExportOrder[];
  ctx: KasirExportContext;
}) {
  const [preview, setPreview] = useState<{ html: string; title: string } | null>(null);

  if (orders.length === 0) return null;

  const guard = (fn: () => void) => {
    if (orders.length === 0) {
      alert("Belum ada transaksi kasir di periode ini.");
      return;
    }
    fn();
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN} onClick={() => guard(() => exportKasirExcel(orders, computeKasirKpis(orders), ctx))}>
          <FileSpreadsheet size={14} className="text-[#2DD4BF]" /> Excel
        </button>
        <button
          type="button"
          className={BTN}
          onClick={() => guard(() => {
            const html = exportKasirPdfHtml(orders, computeKasirKpis(orders), ctx);
            setPreview({ html, title: `Transaksi Kasir · ${ctx.periodLabel}` });
          })}
        >
          <FileText size={14} className="text-[#A78BFA]" /> PDF
        </button>
      </div>

      {preview && (
        <InventoryPrintPreview
          html={preview.html}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
