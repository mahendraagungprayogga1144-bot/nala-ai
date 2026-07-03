"use client";
import { useState, useRef, useEffect } from "react";
import { FileSpreadsheet, FileText, Printer, ChevronDown } from "lucide-react";
import type { ExportContext, InventoryProductInput } from "../lib/export-types";
import {
  runInventoryExcel,
  runInventoryPdfDetail,
  runInventoryPdfRingkas,
  runInventoryThermal,
} from "../lib/export";
import InventoryPrintPreview from "./inventory-print-preview";

type Props = {
  products: InventoryProductInput[];
  businessName: string;
  filterLabel?: string;
};

const BTN =
  "flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#0F0F1A]/80 px-3 py-2.5 text-xs font-medium text-[#8B8AA0] transition-colors hover:border-[#2DD4BF]/30 hover:text-[#F2F1F8] active:scale-[0.98]";

export default function InventoryExportBar({ products, businessName, filterLabel }: Props) {
  const [pdfOpen, setPdfOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [preview, setPreview] = useState<{ html: string; title: string } | null>(null);
  const [thermalWidth, setThermalWidth] = useState("58");
  const [customWidth, setCustomWidth] = useState("72");
  const pdfRef = useRef<HTMLDivElement>(null);

  const ctx: ExportContext = {
    businessName: businessName || "Bisnis Saya",
    businessType: "kuliner",
    filterLabel,
  };

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (pdfRef.current && !pdfRef.current.contains(e.target as Node)) setPdfOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const openPreview = (html: string | null, title: string) => {
    if (!html) return false;
    setPreview({ html, title });
    setPdfOpen(false);
    setPrintOpen(false);
    return true;
  };

  const guard = (fn: () => boolean | string | null, title: string) => {
    if (products.length === 0) {
      alert("Belum ada data stok untuk diekspor.");
      return;
    }
    const result = fn();
    if (typeof result === "string") {
      openPreview(result, title);
    } else if (result !== false) {
      setPdfOpen(false);
      setPrintOpen(false);
    }
  };

  const guardExcel = () => {
    if (products.length === 0) {
      alert("Belum ada data stok untuk diekspor.");
      return;
    }
    runInventoryExcel(products, ctx);
    setPdfOpen(false);
    setPrintOpen(false);
  };

  const resolveThermalMm = (): number => {
    if (thermalWidth === "58") return 58;
    if (thermalWidth === "80") return 80;
    const n = Number(customWidth);
    return Number.isFinite(n) && n >= 48 && n <= 120 ? n : 72;
  };

  return (
    <>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[#5A5B7A] sm:mr-1">
          Ekspor stok
          {filterLabel && <span className="ml-1 normal-case text-[#8B8AA0]">({filterLabel})</span>}
        </p>
        <div className="flex flex-1 flex-wrap gap-2">
          <div className="relative" ref={pdfRef}>
            <button type="button" className={BTN} onClick={() => setPdfOpen(v => !v)}>
              <FileText size={14} className="text-[#2DD4BF]" />
              Unduh PDF
              <ChevronDown size={12} className={pdfOpen ? "rotate-180" : ""} />
            </button>
            {pdfOpen && (
              <div className="absolute bottom-full left-0 z-30 mb-1 min-w-[200px] overflow-hidden rounded-xl border border-white/10 bg-[#0D0D1A] py-1 shadow-xl sm:bottom-auto sm:top-full sm:mb-0 sm:mt-1">
                <button
                  type="button"
                  className="block w-full px-4 py-2.5 text-left text-xs text-[#F2F1F8] hover:bg-white/5"
                  onClick={() => guard(() => runInventoryPdfRingkas(products, ctx), "PDF Ringkas — Stok")}
                >
                  <span className="font-medium text-[#2DD4BF]">Ringkas</span>
                  <span className="mt-0.5 block text-[10px] text-[#8B8AA0]">KPI + Top 10 kritis · untuk owner</span>
                </button>
                <button
                  type="button"
                  className="block w-full px-4 py-2.5 text-left text-xs text-[#F2F1F8] hover:bg-white/5"
                  onClick={() => guard(() => runInventoryPdfDetail(products, ctx), "PDF Detail — Stok")}
                >
                  <span className="font-medium text-[#8B5CF6]">Detail</span>
                  <span className="mt-0.5 block text-[10px] text-[#8B8AA0]">Semua bahan + total nilai</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className={BTN}
            onClick={guardExcel}
          >
            <FileSpreadsheet size={14} className="text-[#38BDF8]" />
            Unduh Excel
          </button>

          <button type="button" className={BTN} onClick={() => setPrintOpen(true)}>
            <Printer size={14} className="text-[#F59E0B]" />
            Cetak
          </button>
        </div>
      </div>

      {printOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          onClick={() => setPrintOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#0F0F1A] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/15 sm:hidden" />
            <h3 className="mb-1 text-sm font-semibold text-[#F0EFF8]">Pilih format cetak</h3>
            <p className="mb-4 text-xs text-[#8B8AA0]">A4 untuk arsip, thermal untuk cek stok cepat di dapur/kasir.</p>

            <div className="mb-4 flex flex-col gap-2">
              <button
                type="button"
                className="rounded-xl border border-white/10 px-4 py-3 text-left text-xs hover:border-[#2DD4BF]/30"
                onClick={() => guard(() => runInventoryPdfRingkas(products, ctx), "PDF Ringkas — Stok")}
              >
                <span className="font-medium text-[#2DD4BF]">A4 — Ringkas (Owner)</span>
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/10 px-4 py-3 text-left text-xs hover:border-[#8B5CF6]/30"
                onClick={() => guard(() => runInventoryPdfDetail(products, ctx), "PDF Detail — Stok")}
              >
                <span className="font-medium text-[#8B5CF6]">A4 — Detail lengkap</span>
              </button>
            </div>

            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-[#5A5B7A]">Thermal printer</p>
            <div className="mb-3 flex gap-2">
              {(["58", "80", "custom"] as const).map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setThermalWidth(opt)}
                  className={
                    "flex-1 rounded-lg border py-2 text-xs font-medium " +
                    (thermalWidth === opt
                      ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/10 text-[#2DD4BF]"
                      : "border-white/10 text-[#8B8AA0]")
                  }
                >
                  {opt === "custom" ? "Custom" : `${opt}mm`}
                </button>
              ))}
            </div>
            {thermalWidth === "custom" && (
              <div className="mb-3">
                <label className="mb-1 block text-[10px] text-[#8B8AA0]">Lebar kertas (48–120 mm)</label>
                <input
                  type="number"
                  min={48}
                  max={120}
                  value={customWidth}
                  onChange={e => setCustomWidth(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#0A0A12] px-3 py-2 text-sm text-[#F2F1F8] focus:border-[#2DD4BF]/50 focus:outline-none"
                />
              </div>
            )}
            <button
              type="button"
              className="w-full rounded-xl py-3 text-sm font-semibold"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}
              onClick={() => guard(
                () => runInventoryThermal(products, ctx, resolveThermalMm()),
                `Thermal ${thermalWidth === "custom" ? resolveThermalMm() : thermalWidth}mm — Stok`,
              )}
            >
              Cetak Thermal {thermalWidth === "custom" ? `${resolveThermalMm()}mm` : `${thermalWidth}mm`}
            </button>
            <button
              type="button"
              className="mt-2 w-full py-2 text-xs text-[#8B8AA0]"
              onClick={() => setPrintOpen(false)}
            >
              Batal
            </button>
          </div>
        </div>
      )}

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
