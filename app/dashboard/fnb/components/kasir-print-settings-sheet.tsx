"use client";
import { useState } from "react";
import { Settings, X } from "lucide-react";
import {
  DEFAULT_KASIR_PRINT_SETTINGS,
  getKasirPrintSettings,
  saveKasirPrintSettings,
  type KasirPrintSettings,
} from "../lib/kasir-print-settings";

export default function KasirPrintSettingsButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<KasirPrintSettings>(DEFAULT_KASIR_PRINT_SETTINGS);

  const openSheet = () => {
    setS(getKasirPrintSettings());
    setOpen(true);
  };

  const save = () => {
    saveKasirPrintSettings(s);
    setOpen(false);
  };

  const Toggle = ({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) => (
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

      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#0F0F1A] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#F0EFF8]">Pengaturan Printer</p>
                <p className="text-[10px] text-[#8B8AA0]">Mode kasir POS — tersimpan di perangkat ini</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-[#8B8AA0]"><X size={16} /></button>
            </div>

            <div className="mb-4 flex flex-col gap-2">
              <Toggle
                label="Cetak otomatis"
                desc="Langsung buka dialog cetak setelah transaksi berhasil (seperti kasir besar)."
                checked={s.autoPrint}
                onChange={v => setS(p => ({ ...p, autoPrint: v }))}
              />
              <Toggle
                label="Tampilkan preview struk"
                desc="Lihat struk dulu sebelum cetak. Matikan untuk alur tercepat."
                checked={s.showPreview}
                onChange={v => setS(p => ({ ...p, showPreview: v }))}
              />
              <Toggle
                label="Tutup otomatis setelah cetak"
                desc="Kembali ke kasir setelah dialog cetak ditutup."
                checked={s.autoCloseAfterPrint}
                onChange={v => setS(p => ({ ...p, autoCloseAfterPrint: v }))}
              />
            </div>

            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-[#5A5B7A]">Lebar kertas</p>
            <div className="mb-4 flex gap-2">
              {[58, 80].map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setS(p => ({ ...p, paperWidthMm: w }))}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium ${s.paperWidthMm === w ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/10 text-[#2DD4BF]" : "border-white/10 text-[#8B8AA0]"}`}
                >
                  {w}mm
                </button>
              ))}
            </div>

            <p className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] leading-relaxed text-amber-200/80">
              Browser tidak bisa cetak 100% diam tanpa dialog sistem. Hubungkan printer thermal Bluetooth lewat dialog cetak HP/tablet, lalu pilih printer default — setelah itu setiap order langsung muncul dialog cetak.
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
        </div>
      )}
    </>
  );
}
