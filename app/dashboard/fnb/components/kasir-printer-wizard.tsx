"use client";
import { useState } from "react";
import { Bluetooth, Printer, Check, ChevronRight } from "lucide-react";
import { buildKasirReceiptHtml } from "../lib/receipt-thermal";
import { executeSilentPrint } from "../lib/trigger-receipt-print";
import { getKasirPrintSettings, saveKasirPrintSettings } from "../lib/kasir-print-settings";
import { markPrinterSetupDone } from "../lib/last-receipt-storage";

export default function KasirPrinterWizard({
  businessName,
  kasirName,
  onDone,
}: {
  businessName: string;
  kasirName?: string;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);

  const finish = () => {
    markPrinterSetupDone();
    onDone();
  };

  const testPrint = () => {
    const width = getKasirPrintSettings().paperWidthMm;
    const html = buildKasirReceiptHtml({
      businessName,
      orderNo: "NTA-TEST-001",
      kasirName: kasirName || "Kasir",
      items: [{ nama: "Contoh Menu", qty: 1, harga: 15000 }],
      subtotal: 15000,
      diskon: 0,
      total: 15000,
      metodeBayar: "tunai",
      catatan: "Struk percobaan setup printer",
      bayar: 20000,
      kembali: 5000,
    }, width);
    executeSilentPrint(html);
    saveKasirPrintSettings({ ...getKasirPrintSettings(), autoPrint: true, showPreview: false });
    setStep(2);
  };

  const steps = [
    {
      icon: Bluetooth,
      title: "1. Pair printer Bluetooth",
      body: "Buka Pengaturan HP → Bluetooth → nyalakan printer thermal → pair (PIN biasanya 0000 atau 1234).",
    },
    {
      icon: Printer,
      title: "2. Cetak struk percobaan",
      body: "Tap tombol di bawah. Di dialog cetak, pilih printer thermal kamu dan set sebagai default.",
    },
    {
      icon: Check,
      title: "3. Siap dipakai!",
      body: "Setiap order berikutnya struk langsung dicetak otomatis. Pengaturan bisa diubah lewat tombol Printer.",
    },
  ];

  const S = steps[step];
  const Icon = S.icon;

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/80 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl border border-[#2DD4BF]/20 bg-[#0F0F1A] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#2DD4BF]">Setup printer · sekali saja</p>
        <h3 className="mb-4 text-base font-semibold text-[#F0EFF8]">Agar struk keluar otomatis</h3>

        <div className="mb-4 flex justify-center gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-[#2DD4BF]" : "bg-white/10"}`} />
          ))}
        </div>

        <div className="mb-5 rounded-2xl border border-white/10 bg-[#0A0A12] p-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#2DD4BF]/10 text-[#2DD4BF]">
            <Icon size={22} />
          </div>
          <p className="mb-2 text-sm font-medium text-[#F0EFF8]">{S.title}</p>
          <p className="text-xs leading-relaxed text-[#8B8AA0]">{S.body}</p>
        </div>

        {step === 0 && (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}
          >
            Sudah pair printer <ChevronRight size={16} />
          </button>
        )}
        {step === 1 && (
          <button
            type="button"
            onClick={testPrint}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}
          >
            <Printer size={16} /> Cetak struk percobaan
          </button>
        )}
        {step === 2 && (
          <button
            type="button"
            onClick={finish}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}
          >
            <Check size={16} /> Mulai kasir
          </button>
        )}

        {step < 2 && (
          <button type="button" onClick={finish} className="mt-2 w-full py-2 text-xs text-[#8B8AA0]">
            Lewati dulu
          </button>
        )}
      </div>
    </div>
  );
}
