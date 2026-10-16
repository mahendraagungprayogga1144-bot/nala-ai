import { AsyncLocalStorage } from "node:async_hooks";

type Sink = { lines: string[] };

const holder = globalThis as typeof globalThis & { __henimaOutbound?: AsyncLocalStorage<Sink> };
const storage = holder.__henimaOutbound ||= new AsyncLocalStorage<Sink>();

export function isCapturingOutbound() {
  return Boolean(storage.getStore());
}

export function captureOutboundLine(text: string) {
  const sink = storage.getStore();
  if (!sink) return false;
  const clean = text.trim();
  if (clean) sink.lines.push(clean.slice(0, 3500));
  return true;
}

export function confirmHint(keyboard?: { text: string }[][]) {
  const labels = (keyboard || []).flat().map((button) => button.text.toLowerCase());
  if (labels.some((label) => label.includes("konfirmasi")) && labels.some((label) => label.includes("batal"))) {
    return "\n\nBalas YA untuk simpan, atau BATAL.";
  }
  return "";
}

export async function captureOutbound(run: () => Promise<void>) {
  const sink: Sink = { lines: [] };
  try {
    await storage.run(sink, run);
  } catch {
    if (!sink.lines.length) sink.lines.push("Pesan sampai, tetapi balasannya gagal. Ketik ulang perintahnya.");
  }
  return sink.lines;
}
