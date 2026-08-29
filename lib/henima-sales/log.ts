import { logAppError } from "@/lib/admin/track-event";
import { maskPhone } from "./phone";

function safeMeta(meta?: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  if (!meta) return safe;
  for (const [k, v] of Object.entries(meta)) {
    const key = k.toLowerCase();
    if (/(token|secret|password|authorization)/.test(key)) continue;
    if (/(phone|telepon|whatsapp)/.test(key) && typeof v === "string") {
      safe[k] = maskPhone(v);
      continue;
    }
    safe[k] = v;
  }
  return safe;
}

export function salesLog(event: string, meta?: Record<string, unknown>) {
  console.info(`[henima-sales] ${event}`, safeMeta(meta));
}

export function salesLogError(event: string, err: unknown, meta?: Record<string, unknown>) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const safe = safeMeta({ ...meta, error: message });
  console.error(`[henima-sales] ${event}`, safe);
  void logAppError({
    source: `henima-sales:${event}`,
    message,
    stack,
    meta: safe,
  });
}
