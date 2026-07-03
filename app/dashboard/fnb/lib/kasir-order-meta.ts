/** Meja / takeaway — disimpan di kolom `catatan` order dengan format tetap. */

export const MEJA_PRESETS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Takeaway"] as const;

export type MejaPreset = (typeof MEJA_PRESETS)[number];

export function buildOrderCatatan(meja: string, catatan: string): string | null {
  const note = catatan.trim();
  if (!meja && !note) return null;
  if (meja === "Takeaway") return note ? `Takeaway · ${note}` : "Takeaway";
  if (meja) return note ? `Meja ${meja} · ${note}` : `Meja ${meja}`;
  return note || null;
}

export function parseMejaFromCatatan(catatan: string | null | undefined): { meja: string | null; note: string | null } {
  if (!catatan) return { meja: null, note: null };
  const takeaway = catatan.match(/^Takeaway(?:\s*·\s*(.+))?$/i);
  if (takeaway) return { meja: "Takeaway", note: takeaway[1]?.trim() || null };
  const meja = catatan.match(/^Meja\s+(\S+)(?:\s*·\s*(.+))?$/i);
  if (meja) return { meja: meja[1], note: meja[2]?.trim() || null };
  return { meja: null, note: catatan };
}

export function mejaLabel(meja: string | null): string | null {
  if (!meja) return null;
  return meja === "Takeaway" ? "Takeaway" : `Meja ${meja}`;
}
