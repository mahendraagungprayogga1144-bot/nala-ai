/** Teks aman untuk pdf-lib StandardFonts (tanpa dependensi Node `fs`). Aman dipakai di client. */

export function pdfSafe(text: string) {
  return text
    .replace(/×/g, "x")
    .replace(/[—–]/g, "-")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
