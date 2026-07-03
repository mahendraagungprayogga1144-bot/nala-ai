export type KasirPrintSettings = {
  /** Langsung buka dialog cetak setelah transaksi */
  autoPrint: boolean;
  /** Tampilkan preview struk sebelum cetak */
  showPreview: boolean;
  /** Tutup preview otomatis setelah cetak */
  autoCloseAfterPrint: boolean;
  /** Lebar kertas thermal (mm) */
  paperWidthMm: number;
};

const KEY = "gercep_kasir_print_settings";

export const DEFAULT_KASIR_PRINT_SETTINGS: KasirPrintSettings = {
  autoPrint: true,
  showPreview: false,
  autoCloseAfterPrint: true,
  paperWidthMm: 58,
};

export function getKasirPrintSettings(): KasirPrintSettings {
  if (typeof window === "undefined") return DEFAULT_KASIR_PRINT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_KASIR_PRINT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<KasirPrintSettings>;
    return {
      autoPrint: parsed.autoPrint ?? true,
      showPreview: parsed.showPreview ?? false,
      autoCloseAfterPrint: parsed.autoCloseAfterPrint ?? true,
      paperWidthMm: clampWidth(parsed.paperWidthMm ?? 58),
    };
  } catch {
    return DEFAULT_KASIR_PRINT_SETTINGS;
  }
}

export function saveKasirPrintSettings(next: KasirPrintSettings) {
  localStorage.setItem(KEY, JSON.stringify({
    ...next,
    paperWidthMm: clampWidth(next.paperWidthMm),
  }));
}

function clampWidth(n: number): number {
  return Math.min(Math.max(Math.round(n), 48), 120);
}
