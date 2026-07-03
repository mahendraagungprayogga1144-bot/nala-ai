"use client";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { getLastReceipt, type StoredReceipt } from "../lib/last-receipt-storage";
import { executeSilentPrint } from "../lib/trigger-receipt-print";
import ReceiptPrintPreview from "./receipt-print-preview";
import { getKasirPrintSettings } from "../lib/kasir-print-settings";

export default function KasirReprintBar({ refreshKey = 0, compact = false }: { refreshKey?: number; compact?: boolean }) {
  const [last, setLast] = useState<StoredReceipt | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setLast(getLastReceipt());
  }, [refreshKey]);

  if (!last) return null;

  const reprint = () => {
    const settings = getKasirPrintSettings();
    if (settings.showPreview) {
      setPreview(true);
    } else {
      executeSilentPrint(last.html);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={reprint}
        title={compact ? `Cetak ulang Rp${last.total.toLocaleString("id-ID")}` : undefined}
        className={
          compact
            ? "flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-[#2DD4BF] hover:border-[#2DD4BF]/30"
            : "flex items-center gap-2 rounded-xl border border-white/10 bg-[#0A0A12]/80 px-3 py-2 text-[10px] text-[#8B8AA0] hover:border-[#2DD4BF]/30 hover:text-[#F2F1F8]"
        }
      >
        <Printer size={compact ? 14 : 12} className="text-[#2DD4BF]" />
        {!compact && (
          <span>
            Cetak ulang <span className="font-mono text-[#2DD4BF]">Rp{last.total.toLocaleString("id-ID")}</span>
          </span>
        )}
      </button>

      {preview && (
        <ReceiptPrintPreview
          html={last.html}
          title={`Struk ${last.orderNo}`}
          widthMm={getKasirPrintSettings().paperWidthMm}
          autoPrint
          autoCloseOnPrint
          onClose={() => setPreview(false)}
        />
      )}
    </>
  );
}
