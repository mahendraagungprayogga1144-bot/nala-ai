/** Indonesian phone identifier — 0812… and 62812… are the same customer. */
export function normalizePhoneId(raw: string | null | undefined): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  let d = digits;
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8") && d.length >= 8 && d.length <= 13) d = "62" + d;
  return d;
}

export function isValidPhoneId(normalized: string) {
  return /^62[0-9]{8,13}$/.test(normalized);
}

export function maskPhone(raw: string | null | undefined): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length < 8) return "****";
  return `${d.slice(0, 4)}****${d.slice(-4)}`;
}

export function displayPhone(raw: string | null | undefined): string {
  const n = normalizePhoneId(raw);
  if (!n) return "—";
  if (n.startsWith("62")) return "0" + n.slice(2);
  return n;
}

export function isSkippedPhone(text: string | null | undefined) {
  const t = (text || "").trim().toLowerCase();
  return /^(ga ada|gak ada|nggak ada|gk ada|tidak ada|tdk ada|skip|-|nohp|no hp|tanpa nomor|belum ada|sembunyi|disembunyikan)$/.test(t);
}

export function isUsablePhone(text: string | null | undefined) {
  return isValidPhoneId(normalizePhoneId(text));
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined) {
  const na = normalizePhoneId(a);
  const nb = normalizePhoneId(b);
  return na.length > 0 && na === nb;
}
