"use client";
import { useEffect, useRef, useCallback } from "react";
import { Printer, X } from "lucide-react";

export default function ReceiptPrintPreview({
  html,
  title,
  widthMm = 58,
  autoPrint = false,
  autoCloseOnPrint = true,
  onClose,
}: {
  html: string;
  title: string;
  widthMm?: number;
  autoPrint?: boolean;
  autoCloseOnPrint?: boolean;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const printedRef = useRef(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handlePrint = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  }, []);

  const handleIframeLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || !iframeRef.current) return;
    iframeRef.current.style.height = `${Math.max(doc.documentElement.scrollHeight, 280)}px`;

    if (autoPrint && !printedRef.current) {
      printedRef.current = true;
      setTimeout(handlePrint, 400);
    }
  }, [autoPrint, handlePrint]);

  useEffect(() => {
    if (!autoCloseOnPrint) return;
    const onAfterPrint = () => onClose();
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, [autoCloseOnPrint, onClose]);

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-[#070711]">
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-white/10 bg-[#0D0D1A] px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#2DD4BF]">{title}</p>
          <p className="text-[10px] text-[#8B8AA0]">
            {autoPrint ? "Mencetak otomatis…" : `Struk thermal ${widthMm}mm`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
            style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}
          >
            <Printer size={14} /> Cetak
          </button>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#8B8AA0] hover:bg-white/5" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center overflow-auto bg-[#1a1a2e] p-4">
        <div className="overflow-hidden rounded-lg bg-white shadow-2xl" style={{ width: `${widthMm}mm`, maxWidth: "100%" }}>
          <iframe
            ref={iframeRef}
            title={title}
            srcDoc={html}
            className="block w-full border-0"
            style={{ minHeight: "320px" }}
            onLoad={handleIframeLoad}
          />
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-white/10 bg-[#0D0D1A] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handlePrint}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}
        >
          <Printer size={16} /> Cetak Ulang
        </button>
        <button type="button" onClick={onClose} className="w-full py-2 text-xs text-[#8B8AA0]">
          + Order berikutnya
        </button>
      </div>
    </div>
  );
}
