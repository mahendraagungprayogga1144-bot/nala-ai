/**
 * Extract numeric figures the owner explicitly wrote in chat.
 * Used so Mentor can analyze without inventing — certainty = owner_stated_in_chat.
 */

export type OwnerStatedFigure = {
  label: string;
  raw: string;
  amountIdrApprox: number | null;
  note: string;
};

function parseIdAmount(numRaw: string, unit: string): number | null {
  const n = Number(String(numRaw).replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return null;
  const u = unit.toLowerCase();
  if (u.startsWith("jt") || u.startsWith("juta")) return Math.round(n * 1_000_000);
  if (u.startsWith("rb") || u.startsWith("ribu") || u === "k") return Math.round(n * 1_000);
  if (u.startsWith("miliar") || u === "m") return Math.round(n * 1_000_000_000);
  return Math.round(n);
}

const PATTERNS: { re: RegExp; label: string }[] = [
  { re: /omzet[^0-9]{0,24}([\d.,]+)\s*(jt|juta|rb|ribu|miliar|m\b)?/gi, label: "omzet" },
  { re: /(?:saldo|sisa)[^0-9]{0,24}([\d.,]+)\s*(jt|juta|rb|ribu|miliar|m\b)?/gi, label: "saldo_kas" },
  { re: /(?:bayar\s*rumah|cicilan|rumah)[^0-9]{0,24}([\d.,]+)\s*(jt|juta|rb|ribu)?/gi, label: "pengeluaran_pribadi" },
  { re: /(?:laba|profit)[^0-9]{0,24}([\d.,]+)\s*(jt|juta|rb|ribu)?/gi, label: "laba" },
  { re: /(?:modal|investasi)[^0-9]{0,24}([\d.,]+)\s*(jt|juta|rb|ribu)?/gi, label: "modal" },
  { re: /rp\s*\.?\s*([\d.,]+)/gi, label: "jumlah_rp" },
];

export function extractOwnerStatedFigures(text: string): OwnerStatedFigure[] {
  const src = text || "";
  const out: OwnerStatedFigure[] = [];
  const seen = new Set<string>();

  for (const { re, label } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const raw = m[0];
      const key = `${label}:${raw}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const amount = parseIdAmount(m[1], m[2] || "");
      out.push({
        label,
        raw,
        amountIdrApprox: amount,
        note: "Angka disebutkan owner di chat — certainty: owner_stated_in_chat (bukan financial memory resmi).",
      });
    }
  }

  // "143 produk" style counts
  const qty = src.match(/([\d.,]+)\s*produk/i);
  if (qty) {
    out.push({
      label: "jumlah_produk",
      raw: qty[0],
      amountIdrApprox: null,
      note: "Kuantitas disebut owner di chat.",
    });
  }

  return out.slice(0, 12);
}

export function formatOwnerStatedFiguresForPrompt(figures: OwnerStatedFigure[]): string {
  if (!figures.length) return "";
  return [
    "ANGKA YANG OWNER SEBUTKAN DI CHAT (boleh dipakai untuk analisis bersyarat):",
    ...figures.map(
      (f) =>
        `- ${f.label}: "${f.raw}"` +
        (f.amountIdrApprox != null ? ` ≈ Rp ${f.amountIdrApprox.toLocaleString("id-ID")}` : "") +
        ` | ${f.note}`,
    ),
    "Aturan: jangan mengarang angka lain. Bedakan jelas: (1) Financial Memory resmi, (2) angka dari chat owner, (3) data Gercep Phase 4.",
    "Sarankan owner menyimpan angka chat ke Catatan Keuangan (Financial Memory) agar jadi actual/estimate resmi.",
  ].join("\n");
}
