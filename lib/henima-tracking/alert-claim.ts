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

/**
 * Klaim kirim pertama, atau izinkan kirim ulang jika cooldown lewat.
 * return count = nomor pengingat (1 = pertama).
 */
export async function claimOrRemind(
  db: SalesDb,
  businessId: string,
  day: string,
  kind: AlertKind,
  staffId: string | null,
  cooldownMs: number,
): Promise<{ ok: boolean; count: number }> {
  let q = db
    .from("module_henima_tracking_tg_alerts")
    .select("id, last_sent_at, created_at, send_count")
    .eq("business_id", businessId)
    .eq("day", day)
    .eq("kind", kind);
  q = staffId ? q.eq("staff_id", staffId) : q.is("staff_id", null);
  const { data: existing, error: readErr } = await q.maybeSingle();
  if (readErr && /does not exist|schema cache/i.test(readErr.message || "")) {
    return { ok: false, count: 0 };
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
    if (!error) return { ok: true, count: 1 };
    const msg = error.message || "";
    if (/duplicate|unique/i.test(msg)) return { ok: false, count: 0 };
    if (/does not exist|schema cache/i.test(msg)) return { ok: false, count: 0 };
    return { ok: false, count: 0 };
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
  if (upErr) return { ok: false, count: 0 };
  return { ok: true, count: nextCount };
}

export async function claimOnce(
  db: SalesDb,
  businessId: string,
  day: string,
  kind: AlertKind,
  staffId: string | null,
) {
  const { error } = await db.from("module_henima_tracking_tg_alerts").insert({
    business_id: businessId,
    staff_id: staffId,
    day,
    kind,
    send_count: 1,
    last_sent_at: new Date().toISOString(),
  });
  if (!error) return true;
  const msg = error.message || "";
  if (/duplicate|unique/i.test(msg)) return false;
  if (/does not exist|schema cache/i.test(msg)) return false;
  return false;
}
