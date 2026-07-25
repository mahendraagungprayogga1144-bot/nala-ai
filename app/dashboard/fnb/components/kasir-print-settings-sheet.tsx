"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Settings, X } from "lucide-react";
import {
  DEFAULT_KASIR_PRINT_SETTINGS,
  getKasirPrintSettings,
  saveKasirPrintSettings,
  type KasirPrintSettings,
} from "../lib/kasir-print-settings";

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-3 rounded-xl border border-white/10 px-3 py-3 text-left"
    >
      <div>
        <p className="text-xs font-medium text-[#F0EFF8]">{label}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-[#8B8AA0]">{desc}</p>
      </div>
      <div
        className={`mt-0.5 h-6 w-10 flex-shrink-0 rounded-full p-0.5 transition-colors ${checked ? "bg-[#2DD4BF]" : "bg-white/10"}`}
      >
        <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </div>
    </button>
  );
}

export default function KasirPrintSettingsButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [s, setS] = useState<KasirPrintSettings>(DEFAULT_KASIR_PRINT_SETTINGS);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const openSheet = () => {
    setS(getKasirPrintSettings());
    setOpen(true);
  };

  const save = () => {
    saveKasirPrintSettings(s);
    setOpen(false);
  };

  const sheet =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="max-h-[min(92dvh,640px)] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0F0F1A] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#F0EFF8]">Pengaturan Printer</p>
                  <p className="text-[10px] text-[#8B8AA0]">Mode kasir POS — tersimpan di perangkat ini</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-[#8B8AA0]">
                  <X size={16} />
                </button>
              </div>

              <div className="mb-4 flex flex-col gap-2">
                <Toggle
                  label="Cetak otomatis"
                  desc="Langsung buka dialog cetak setelah transaksi berhasil (seperti kasir besar)."
                  checked={s.autoPrint}
                  onChange={(v) => setS((p) => ({ ...p, autoPrint: v }))}
                />
                <Toggle
                  label="Tampilkan preview struk"
                  desc="Lihat struk dulu sebelum cetak. Matikan untuk alur tercepat."
                  checked={s.showPreview}
                  onChange={(v) => setS((p) => ({ ...p, showPreview: v }))}
                />
                <Toggle
                  label="Tutup otomatis setelah cetak"
                  desc="Kembali ke kasir setelah dialog cetak ditutup."
                  checked={s.autoCloseAfterPrint}
                  onChange={(v) => setS((p) => ({ ...p, autoCloseAfterPrint: v }))}
                />
              </div>

              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#5A5B7A]">
                Kertas struk printer thermal
              </p>
              <p className="mb-2 text-[10px] leading-relaxed text-[#8B8AA0]">
                Pilih lebar sesuai printer toko (umum 58mm atau 80mm). Custom untuk ukuran lain.
              </p>
              <div className="mb-2 flex gap-2">
                {([58, 80] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setS((p) => ({ ...p, paperWidthMm: w }))}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium ${
                      s.paperWidthMm === w
                        ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/10 text-[#2DD4BF]"
                        : "border-white/10 text-[#8B8AA0]"
                    }`}
                  >
                    {w}mm
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setS((p) => ({
                      ...p,
                      paperWidthMm: p.paperWidthMm === 58 || p.paperWidthMm === 80 ? 72 : p.paperWidthMm,
                    }))
                  }
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium ${
                    s.paperWidthMm !== 58 && s.paperWidthMm !== 80
                      ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/10 text-[#2DD4BF]"
                      : "border-white/10 text-[#8B8AA0]"
                  }`}
                >
                  Custom
                </button>
              </div>
              {s.paperWidthMm !== 58 && s.paperWidthMm !== 80 && (
                <div className="mb-4 flex items-center gap-2">
                  <input
                    type="number"
                    min={48}
                    max={120}
                    value={s.paperWidthMm}
                    onChange={(e) =>
                      setS((p) => ({
                        ...p,
                        paperWidthMm: Math.min(120, Math.max(48, Number(e.target.value) || 58)),
                      }))
                    }
                    className="w-24 rounded-lg border border-white/10 bg-[#0A0A12] px-3 py-2 text-sm text-[#F0EFF8]"
                  />
                  <span className="text-xs text-[#8B8AA0]">mm (48–120)</span>
                </div>
              )}
              {(s.paperWidthMm === 58 || s.paperWidthMm === 80) && <div className="mb-4" />}

              <p className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] leading-relaxed text-amber-200/80">
                Browser tidak bisa cetak 100% diam tanpa dialog sistem. Hubungkan printer thermal Bluetooth lewat dialog
                cetak HP/tablet, lalu pilih printer default — setelah itu setiap order langsung muncul dialog cetak.
              </p>

              <button
                type="button"
                onClick={save}
                className="w-full rounded-xl py-3 text-sm font-semibold"
                style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}
              >
                Simpan
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className={
          compact
            ? "flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-[#8B8AA0] hover:border-[#2DD4BF]/30 hover:text-[#F2F1F8]"
            : "flex items-center gap-1.5 rounded-xl border border-white/10 px-2.5 py-1.5 text-[10px] text-[#8B8AA0] hover:border-[#2DD4BF]/30 hover:text-[#F2F1F8]"
        }
        title="Pengaturan printer"
      >
        <Settings size={compact ? 14 : 13} />
        {!compact && " Printer"}
      </button>
      {sheet}
    </>
  );
}
