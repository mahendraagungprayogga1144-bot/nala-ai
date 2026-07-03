const KEY = "gercep_kasir_last_receipt";

export type StoredReceipt = {
  html: string;
  orderNo: string;
  total: number;
  savedAt: string;
};

export function saveLastReceipt(data: StoredReceipt) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getLastReceipt(): StoredReceipt | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredReceipt;
  } catch {
    return null;
  }
}

const SETUP_KEY = "gercep_kasir_printer_setup_done";

export function isPrinterSetupDone(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(SETUP_KEY) === "1";
}

export function markPrinterSetupDone() {
  localStorage.setItem(SETUP_KEY, "1");
}
