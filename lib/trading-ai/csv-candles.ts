/**
 * Parse MT5 / generic OHLC CSV into Candle[].
 * Does not change Trading AI brain rules — data feed only.
 *
 * Supported shapes:
 * - Header: time/datetime/date + open,high,low,close (+ optional volume)
 * - MT5: DATE,TIME,OPEN,HIGH,LOW,CLOSE,TICKVOL,VOL,SPREAD
 * - Combined datetime or unix seconds/ms
 */

import type { Candle } from "./types";

export type ParseCandlesResult =
  | { ok: true; candles: Candle[]; warnings: string[] }
  | { ok: false; error: string };

function detectDelimiter(line: string) {
  if (line.includes("\t")) return "\t";
  if (line.includes(";")) return ";";
  return ",";
}

function stripBom(text: string) {
  return text.replace(/^\uFEFF/, "");
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/[<>]/g, "").replace(/\s+/g, "");
}

function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Parse date+time (MT5: 2024.01.15 + 10:05) or ISO / unix. */
function parseTime(parts: Record<string, string>, row: string[]): number | null {
  // Prefer DATE + TIME (MT5 export)
  if (parts.date != null && parts.time != null) {
    const sec = parseDateTimeString(`${parts.date.trim()} ${parts.time.trim()}`);
    if (sec != null) return sec;
  }

  const single = parts.datetime ?? parts.timestamp ?? (!parts.date ? parts.time : null);
  if (single != null) {
    const v = single.trim();
    const asNum = Number(v);
    if (Number.isFinite(asNum) && asNum > 1e9) {
      return asNum > 1e12 ? Math.floor(asNum / 1000) : Math.floor(asNum);
    }
    const sec = parseDateTimeString(v);
    if (sec != null) return sec;
  }

  if (parts.date != null && parts.time == null) {
    const sec = parseDateTimeString(parts.date.trim());
    if (sec != null) return sec;
  }

  // positional MT5 without header: DATE TIME OPEN HIGH LOW CLOSE ...
  if (row.length >= 6) {
    const sec = parseDateTimeString(`${row[0]?.trim()} ${row[1]?.trim()}`);
    if (sec != null) return sec;
  }

  return null;
}

function parseDateTimeString(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  // 2024.06.01 10:05[:00] or 2024-06-01 ...
  const m = s.match(
    /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const hh = Number(m[4] ?? 0);
    const mm = Number(m[5] ?? 0);
    const ss = Number(m[6] ?? 0);
    const ms = Date.UTC(y, mo, d, hh, mm, ss);
    if (Number.isFinite(ms)) return Math.floor(ms / 1000);
  }

  const iso = Date.parse(s.replace(/\./g, "-"));
  if (Number.isFinite(iso)) return Math.floor(iso / 1000);
  return null;
}

function mapRow(
  headers: string[] | null,
  cols: string[],
): { time: number; open: number; high: number; low: number; close: number; volume?: number } | null {
  if (headers) {
    const parts: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (cols[i] != null) parts[h] = cols[i];
    });
    const time = parseTime(parts, cols);
    const open = parseNumber(parts.open ?? parts.o ?? "");
    const high = parseNumber(parts.high ?? parts.h ?? "");
    const low = parseNumber(parts.low ?? parts.l ?? "");
    const close = parseNumber(parts.close ?? parts.c ?? "");
    if (time == null || open == null || high == null || low == null || close == null) return null;
    const volume = parseNumber(parts.volume ?? parts.tickvol ?? parts.vol ?? "");
    return { time, open, high, low, close, volume: volume ?? undefined };
  }

  // Header-less MT5-style: DATE TIME OPEN HIGH LOW CLOSE ...
  if (cols.length < 6) return null;
  const d = cols[0]?.trim().replace(/\./g, "-");
  const t = cols[1]?.trim();
  let time = Date.parse(`${d}T${t.length === 5 ? `${t}:00` : t}Z`);
  if (!Number.isFinite(time)) time = Date.parse(`${d} ${t}`);
  if (!Number.isFinite(time)) return null;
  const open = parseNumber(cols[2] ?? "");
  const high = parseNumber(cols[3] ?? "");
  const low = parseNumber(cols[4] ?? "");
  const close = parseNumber(cols[5] ?? "");
  const volume = parseNumber(cols[6] ?? "");
  if (open == null || high == null || low == null || close == null) return null;
  return {
    time: Math.floor(time / 1000),
    open,
    high,
    low,
    close,
    volume: volume ?? undefined,
  };
}

function looksLikeHeader(cols: string[]) {
  const joined = cols.map(normalizeHeader).join(" ");
  return /open/.test(joined) && /high/.test(joined) && /low/.test(joined) && /close/.test(joined);
}

export function parseCandlesCsv(text: string): ParseCandlesResult {
  const raw = stripBom(text).trim();
  if (!raw) return { ok: false, error: "File CSV kosong." };

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { ok: false, error: "Tidak ada baris data." };

  const delim = detectDelimiter(lines[0]);
  let headers: string[] | null = null;
  let start = 0;
  const firstCols = lines[0].split(delim).map((c) => c.trim());
  if (looksLikeHeader(firstCols)) {
    headers = firstCols.map(normalizeHeader);
    start = 1;
  }

  const candles: Candle[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(delim).map((c) => c.trim());
    if (cols.length < 5) {
      skipped++;
      continue;
    }
    const row = mapRow(headers, cols);
    if (!row) {
      skipped++;
      continue;
    }
    if (row.high < row.low) {
      skipped++;
      continue;
    }
    candles.push({
      time: row.time,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    });
  }

  if (!candles.length) {
    return {
      ok: false,
      error:
        "Gagal parse candle. Pakai kolom time/date+time, open, high, low, close (format MT5 juga OK).",
    };
  }

  candles.sort((a, b) => a.time - b.time);
  // dedupe same timestamp keep last
  const deduped: Candle[] = [];
  for (const c of candles) {
    if (deduped.length && deduped[deduped.length - 1].time === c.time) {
      deduped[deduped.length - 1] = c;
    } else {
      deduped.push(c);
    }
  }

  if (skipped) warnings.push(`${skipped} baris dilewati (format tidak valid).`);
  warnings.push(`${deduped.length} candle ter-load.`);

  return { ok: true, candles: deduped, warnings };
}

export async function parseCandlesFile(file: File): Promise<ParseCandlesResult> {
  const text = await file.text();
  return parseCandlesCsv(text);
}
