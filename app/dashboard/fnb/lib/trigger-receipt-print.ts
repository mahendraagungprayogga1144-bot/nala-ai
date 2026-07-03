import { getKasirPrintSettings } from "./kasir-print-settings";
import { printReceiptSilently } from "./print-receipt";

export type ReceiptPrintResult =
  | { mode: "silent" }
  | { mode: "preview"; autoPrint: boolean; autoClose: boolean; widthMm: number }
  | { mode: "manual"; widthMm: number };

/** Tentukan cara cetak struk berdasarkan pengaturan perangkat */
export function planReceiptPrint(): ReceiptPrintResult {
  const settings = getKasirPrintSettings();
  const widthMm = settings.paperWidthMm;

  if (!settings.autoPrint) {
    return { mode: "manual", widthMm };
  }
  if (!settings.showPreview) {
    return { mode: "silent" };
  }
  return {
    mode: "preview",
    autoPrint: true,
    autoClose: settings.autoCloseAfterPrint,
    widthMm,
  };
}

export function executeSilentPrint(html: string): boolean {
  return printReceiptSilently(html);
}
