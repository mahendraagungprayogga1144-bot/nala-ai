import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanText } from "./text";

export type AuditAction = "create" | "update" | "delete" | "approve" | "reject" | "correct";

export async function writeAudit(
  db: SupabaseClient,
  opts: {
    ownerUserId: string;
    businessId?: string | null;
    entityType: string;
    entityId: string;
    action: AuditAction;
    summary?: string;
    before?: unknown;
    after?: unknown;
  },
) {
  try {
    await db.from("module_master_mentor_audit_logs").insert({
      owner_user_id: opts.ownerUserId,
      business_id: opts.businessId || null,
      entity_type: cleanText(opts.entityType, 80),
      entity_id: cleanText(opts.entityId, 80),
      action: opts.action,
      summary: cleanText(opts.summary || "", 500),
      before_data: opts.before ?? null,
      after_data: opts.after ?? null,
    });
  } catch (err) {
    console.error("[master-mentor/audit]", err instanceof Error ? err.message : err);
  }
}
