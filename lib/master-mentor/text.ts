import { MentorValidationError } from "./types";

export function cleanText(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, max);
}

export function requireText(value: unknown, label: string, max: number) {
  const text = cleanText(value, max);
  if (!text) throw new MentorValidationError(`${label} wajib diisi.`);
  return text;
}

export function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  label: string,
): T {
  const raw = cleanText(value, 64).toLowerCase();
  if (!raw) return fallback;
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new MentorValidationError(`${label} tidak valid. Pilih: ${allowed.join(", ")}.`);
  }
  return raw as T;
}

export function requireEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  const raw = cleanText(value, 64).toLowerCase();
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new MentorValidationError(`${label} tidak valid. Pilih: ${allowed.join(", ")}.`);
  }
  return raw as T;
}

export function requireUuid(value: unknown, label: string) {
  const id = cleanText(value, 80);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new MentorValidationError(`${label} tidak valid.`);
  }
  return id;
}

export function requireDate(value: unknown, label: string) {
  const raw = cleanText(value, 32);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new MentorValidationError(`${label} harus format YYYY-MM-DD.`);
  }
  return raw;
}

export function requireAmount(value: unknown, label: string) {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n)) throw new MentorValidationError(`${label} harus angka.`);
  if (Math.abs(n) > 1e15) throw new MentorValidationError(`${label} di luar batas.`);
  return Math.round(n * 100) / 100;
}

export function isMissingTable(err: unknown, tableHint: string) {
  const msg =
    err && typeof err === "object" && "message" in err
      ? String((err as { message?: unknown }).message || "")
      : err instanceof Error
        ? err.message
        : String(err || "");
  return new RegExp(`${tableHint}|does not exist|schema cache|relation`, "i").test(msg);
}

export function tokenizeQuery(q: string) {
  return q
    .toLowerCase()
    .split(/[^a-z0-9\u00c0-\u024f]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 12);
}

export function textMatches(haystack: string, tokens: string[]) {
  if (!tokens.length) return true;
  const h = haystack.toLowerCase();
  return tokens.some((t) => h.includes(t));
}
