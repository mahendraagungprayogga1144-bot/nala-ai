import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  buildRiskAlerts,
  loadBusinessFacts,
  resolveIntelligencePeriod,
  resolveLinkedBusiness,
} from "../intelligence";
import { listPortfolioBusinesses } from "../portfolio-service";
import { isMissingTable } from "../text";
import type { SmartAlertRow } from "./types";

const TABLE = "module_master_mentor_smart_alerts";

function fingerprint(ownerUserId: string, businessId: string | null, alertKey: string, dayBucket: string) {
  return createHash("sha256")
    .update(`${ownerUserId}|${businessId || ""}|${alertKey}|${dayBucket}`)
    .digest("hex")
    .slice(0, 40);
}

/** Upsert alerts with dedupe — same fingerprint within day does not spam. */
export async function syncSmartAlertsForOwner(
  db: SupabaseClient,
  ownerUserId: string,
): Promise<{ upserted: number; open: SmartAlertRow[]; notice: string | null }> {
  const { rows: portfolio } = await listPortfolioBusinesses(db, ownerUserId);
  const window = resolveIntelligencePeriod("last_7_days");
  const dayBucket = window.to;
  let upserted = 0;
  const open: SmartAlertRow[] = [];

  for (const biz of portfolio.slice(0, 10)) {
    const linked = await resolveLinkedBusiness(db, ownerUserId, biz.id);
    if (!linked.linked) continue;
    const facts = await loadBusinessFacts(db, linked, window);
    const risks = buildRiskAlerts(facts);

    for (const r of risks) {
      const fp = fingerprint(ownerUserId, biz.id, r.id, dayBucket);
      const { data: existing } = await db
        .from(TABLE)
        .select("*")
        .eq("owner_user_id", ownerUserId)
        .eq("fingerprint", fp)
        .maybeSingle();

      if (existing) {
        if (existing.status === "muted" && existing.muted_until && existing.muted_until > new Date().toISOString()) {
          continue;
        }
        const { data: updated, error } = await db
          .from(TABLE)
          .update({
            last_seen_at: new Date().toISOString(),
            evidence: r.supportingData,
            recommended_action: r.recommendedAction,
            severity: r.severity,
            status: existing.status === "resolved" ? "open" : existing.status,
          })
          .eq("id", existing.id)
          .select("*")
          .maybeSingle();
        if (!error && updated) {
          open.push(updated as SmartAlertRow);
          upserted += 1;
        }
        continue;
      }

      const { data: inserted, error } = await db
        .from(TABLE)
        .insert({
          owner_user_id: ownerUserId,
          business_id: biz.id,
          alert_key: r.id,
          issue: r.issue,
          severity: r.severity,
          evidence: r.supportingData,
          recommended_action: r.recommendedAction,
          kind: r.kind,
          status: "open",
          fingerprint: fp,
          notify_count: 0,
        })
        .select("*")
        .maybeSingle();
      if (error) {
        if (isMissingTable(error, TABLE)) {
          return { upserted: 0, open: [], notice: "Tabel smart alerts belum aktif. Jalankan migration Phase 6." };
        }
        continue;
      }
      if (inserted) {
        open.push(inserted as SmartAlertRow);
        upserted += 1;
      }
    }
  }

  return { upserted, open, notice: null };
}

export async function listSmartAlerts(
  db: SupabaseClient,
  ownerUserId: string,
  status = "open",
): Promise<{ rows: SmartAlertRow[]; notice: string | null }> {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("status", status)
    .order("last_seen_at", { ascending: false })
    .limit(100);
  if (error) {
    if (isMissingTable(error, TABLE)) {
      return { rows: [], notice: "Tabel smart alerts belum aktif. Jalankan migration Phase 6." };
    }
    return { rows: [], notice: error.message };
  }
  return { rows: (data || []) as SmartAlertRow[], notice: null };
}

export async function muteSmartAlert(
  db: SupabaseClient,
  ownerUserId: string,
  id: string,
  hours = 24,
) {
  const until = new Date(Date.now() + hours * 3600_000).toISOString();
  await db
    .from(TABLE)
    .update({ status: "muted", muted_until: until })
    .eq("id", id)
    .eq("owner_user_id", ownerUserId);
}
