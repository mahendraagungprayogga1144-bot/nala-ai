"use client";
import { useEffect, useRef } from "react";
import { Printer, X } from "lucide-react";

export default function InventoryPrintPreview({
  html,
  title,
  onClose,
}: {
  html: string;
  title: string;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handlePrint = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#070711]">
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-white/10 bg-[#0D0D1A] px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#F0EFF8]">{title}</p>
          <p className="text-[10px] text-[#8B8AA0]">Preview laporan · putih saat cetak</p>
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#8B8AA0] hover:bg-white/5"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#1a1a2e] p-3 sm:p-6">
        <div className="mx-auto max-w-[210mm] overflow-hidden rounded-lg bg-white shadow-2xl">
          <iframe
            ref={iframeRef}
            title={title}
            srcDoc={html}
            className="block w-full border-0"
            style={{ minHeight: "70vh", height: "calc(100dvh - 8rem)" }}
            onLoad={() => {
              const doc = iframeRef.current?.contentDocument;
              if (!doc) return;
              const h = doc.documentElement.scrollHeight;
              if (iframeRef.current) iframeRef.current.style.height = `${Math.max(h, 400)}px`;
            }}
          />
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-white/10 bg-[#0D0D1A] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}
        >
          <Printer size={16} /> Cetak Sekarang
        </button>
      </div>
    </div>
  );
}
