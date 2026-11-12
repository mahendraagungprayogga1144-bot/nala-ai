import "server-only";
import type { SalesDb } from "@/lib/henima-sales/db";

export type AlertKind =
  | "senyap"
  | "sepi"
  | "kembali"
  | "laporan"
  | "absen"
  | "mock"
  | "lompatan"
  | "zero_visit"
  | "belum_pulang";

function missingTable(msg: string) {
  return /does not exist|schema cache/i.test(msg);
}

/** Cadangan dedupe in-memory kalau tabel migrasi belum ada (anti spam + tetap kirim). */
const memCooldown = new Map<string, { at: number; count: number }>();

function memKey(businessId: string, day: string, kind: string, staffId: string | null) {
  return `${businessId}|${day}|${kind}|${staffId || "-"}`;
}

function memClaim(key: string, cooldownMs: number): { ok: boolean; count: number } {
  const hit = memBag.get(key);
  const now = Date.now();
  if (!hit) {
    memBag.set(key, { at: now, count: 1 });
    return { ok: true, count: 1 };
  }
  if (now - hit.at < cooldownMs) return { ok: false, count: hit.count };
  hit.count += 1;
  hit.at = now;
  return { ok: true, count: hit.count };
}

/**
 * Klaim kirim pertama, atau izinkan kirim ulang jika cooldown lewat.
 * Tabel belum migrasi → fallback memori (tetap kirim, jangan bungkam).
 */
export async function claimOrRemind(
  db: SalesDb,
  businessId: string,
  day: string,
  kind: AlertKind,
  staffId: string | null,
  cooldownMs: number,
): Promise<{ ok: boolean; count: number }> {
  const key = memKey(businessId, day, kind, staffId);
  let q = db
    .from("module_henima_tracking_tg_alerts")
    .select("id, last_sent_at, created_at, send_count")
    .eq("business_id", businessId)
    .eq("day", day)
    .eq("kind", kind);
  q = staffId ? q.eq("staff_id", staffId) : q.is("staff_id", null);
  const { data: existing, error: readErr } = await q.maybeSingle();
  if (readErr && missingTable(readErr.message || "")) {
    return memClaim(key, cooldownMs);
  }

  const row = existing as
    | { id: string; last_sent_at?: string; created_at: string; send_count?: number }
    | null;

  if (!row) {
    const { error } = await db.from("module_henima_tracking_tg_alerts").insert({
      business_id: businessId,
      staff_id: staffId,
      day,
      kind,
      send_count: 1,
      last_sent_at: new Date().toISOString(),
    });
    if (!error) {
      memBag.set(key, { at: Date.now(), count: 1 });
      return { ok: true, count: 1 };
    }
    const msg = error.message || "";
    if (/duplicate|unique/i.test(msg)) return { ok: false, count: 0 };
    return memClaim(key, cooldownMs);
  }

  const lastIso = row.last_sent_at || row.created_at;
  const age = Date.now() - new Date(lastIso).getTime();
  if (age < cooldownMs) return { ok: false, count: row.send_count || 1 };

  const nextCount = (row.send_count || 1) + 1;
  const { error: upErr } = await db
    .from("module_henima_tracking_tg_alerts")
    .update({
      send_count: nextCount,
      last_sent_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (upErr) return memClaim(key, cooldownMs);
  memBag.set(key, { at: Date.now(), count: nextCount });
  return { ok: true, count: nextCount };
}

export async function claimOnce(
  db: SalesDb,
  businessId: string,
  day: string,
  kind: AlertKind,
  staffId: string | null,
) {
  const key = memKey(businessId, day, kind, staffId);
  const { error } = await db.from("module_henima_tracking_tg_alerts").insert({
    business_id: businessId,
    staff_id: staffId,
    day,
    kind,
    send_count: 1,
    last_sent_at: new Date().toISOString(),
  });
  if (!error) {
    memBag.set(key, { at: Date.now(), count: 1 });
    return true;
  }
  const msg = error.message || "";
  if (/duplicate|unique/i.test(msg)) return false;
  // Tabel belum ada: sekali per cold instance / hari lewat memori.
  const mem = memClaim(key, 20 * 60 * 60_000);
  return mem.ok;
}
