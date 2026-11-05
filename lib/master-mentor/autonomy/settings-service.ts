import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTable } from "../text";
import { MentorValidationError } from "../types";
import { isAutonomyLevel, type AutonomyLevel, type AutonomySettings } from "./types";
import { writeAudit } from "../audit";

const TABLE = "module_master_mentor_autonomy_settings";
const STOP = "module_master_mentor_emergency_stops";

function defaults(ownerUserId: string): AutonomySettings {
  const now = new Date().toISOString();
  return {
    owner_user_id: ownerUserId,
    autonomy_level: 0,
    emergency_stop: false,
    allowed_level3_tools: [],
    max_concurrent_tasks: 3,
    notes: "",
    created_at: now,
    updated_at: now,
  };
}

export async function getAutonomySettings(
  db: SupabaseClient,
  ownerUserId: string,
): Promise<{ row: AutonomySettings; notice: string | null }> {
  const { data, error } = await db.from(TABLE).select("*").eq("owner_user_id", ownerUserId).maybeSingle();
  if (error) {
    if (isMissingTable(error, TABLE)) {
      return { row: defaults(ownerUserId), notice: "Tabel autonomy settings belum aktif. Jalankan migration Phase 7." };
    }
    return { row: defaults(ownerUserId), notice: error.message };
  }
  return { row: (data as AutonomySettings) || defaults(ownerUserId), notice: null };
}

export async function upsertAutonomySettings(
  db: SupabaseClient,
  ownerUserId: string,
  patch: {
    autonomy_level?: AutonomyLevel;
    emergency_stop?: boolean;
    allowed_level3_tools?: string[];
    max_concurrent_tasks?: number;
    notes?: string;
  },
): Promise<AutonomySettings> {
  const { row: current } = await getAutonomySettings(db, ownerUserId);
  const next = {
    owner_user_id: ownerUserId,
    autonomy_level: isAutonomyLevel(patch.autonomy_level) ? patch.autonomy_level : current.autonomy_level,
    emergency_stop: typeof patch.emergency_stop === "boolean" ? patch.emergency_stop : current.emergency_stop,
    allowed_level3_tools: Array.isArray(patch.allowed_level3_tools)
      ? patch.allowed_level3_tools.map(String).slice(0, 40)
      : current.allowed_level3_tools,
    max_concurrent_tasks: Math.min(20, Math.max(1, Number(patch.max_concurrent_tasks) || current.max_concurrent_tasks)),
    notes: String(patch.notes ?? current.notes).slice(0, 2000),
    updated_at: new Date().toISOString(),
  };

  // Never allow self-escalation above 3; UI/API already capped. Level 3 tools only from allowlist.
  const { data, error } = await db
    .from(TABLE)
    .upsert(next, { onConflict: "owner_user_id" })
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error, TABLE)) {
      throw new MentorValidationError("Tabel autonomy settings belum aktif. Jalankan migration Phase 7.");
    }
    throw new MentorValidationError(error.message || "Gagal menyimpan autonomy settings.");
  }
  await writeAudit(db, {
    ownerUserId,
    entityType: "autonomy_settings",
    entityId: ownerUserId,
    action: "update",
    summary: `Autonomy level=${next.autonomy_level} stop=${next.emergency_stop}`,
    before: current,
    after: data,
  });
  return data as AutonomySettings;
}

export async function setEmergencyStop(
  db: SupabaseClient,
  ownerUserId: string,
  active: boolean,
  reason = "",
): Promise<AutonomySettings> {
  if (active) {
    await db.from(STOP).insert({
      owner_user_id: ownerUserId,
      active: true,
      reason: String(reason || "Owner emergency stop").slice(0, 1000),
    });
  } else {
    await db
      .from(STOP)
      .update({ active: false, cleared_at: new Date().toISOString() })
      .eq("owner_user_id", ownerUserId)
      .eq("active", true);
  }
  return upsertAutonomySettings(db, ownerUserId, { emergency_stop: active, notes: reason });
}
