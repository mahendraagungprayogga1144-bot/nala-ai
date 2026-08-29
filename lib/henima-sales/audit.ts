import type { Actor, AuditAction } from "./types";
import type { SalesDb } from "./db";
import { maskPhone } from "./phone";

function scrub(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(scrub);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/(token|secret|password|authorization)/i.test(k)) continue;
      if (/(phone|telepon|whatsapp)/i.test(k) && typeof v === "string") {
        out[k] = maskPhone(v);
      } else {
        out[k] = scrub(v);
      }
    }
    return out;
  }
  return value;
}

export async function writeAudit(
  db: SalesDb,
  actor: Actor | null,
  opts: {
    businessId: string;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
  },
) {
  await db.from("module_sales_audit_logs").insert({
    business_id: opts.businessId,
    actor_id: actor?.userId || actor?.staffId || null,
    actor_telegram_id: actor?.telegramUserId || null,
    action: opts.action,
    entity_type: opts.entityType,
    entity_id: opts.entityId || null,
    old_value: opts.oldValue != null ? scrub(opts.oldValue) : null,
    new_value: opts.newValue != null ? scrub(opts.newValue) : null,
  });
}
