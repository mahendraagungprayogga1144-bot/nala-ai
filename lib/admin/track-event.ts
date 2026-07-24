import { createAdminClient } from "@/lib/supabase/admin";

export type TrackPayload = {
  event: string;
  module?: string;
  meta?: Record<string, unknown>;
  path?: string;
  business_id?: string | null;
  user_id?: string | null;
  ua?: string | null;
};

const SENSITIVE = /password|token|secret|authorization|cookie|apikey|service_role/i;

export function sanitizeMeta(meta?: Record<string, unknown>) {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE.test(k)) continue;
    if (typeof v === "string" && v.length > 500) {
      out[k] = v.slice(0, 500);
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** Server-side fire-and-forget event insert. */
export async function trackEvent(payload: TrackPayload) {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    await admin.from("app_events").insert({
      user_id: payload.user_id || null,
      business_id: payload.business_id || null,
      event: payload.event,
      module: payload.module || null,
      meta: sanitizeMeta(payload.meta),
      path: payload.path || null,
      ua: payload.ua ? String(payload.ua).slice(0, 180) : null,
    });
  } catch {
    // never break product flows
  }
}

/** Browser helper — posts to /api/track. */
export function trackClientEvent(payload: Omit<TrackPayload, "user_id" | "ua">) {
  if (typeof window === "undefined") return;
  void fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

export async function logAppError(opts: {
  user_id?: string | null;
  source: string;
  message: string;
  stack?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    await admin.from("app_errors").insert({
      user_id: opts.user_id || null,
      source: opts.source,
      message: String(opts.message).slice(0, 1000),
      stack: opts.stack ? String(opts.stack).slice(0, 4000) : null,
      meta: sanitizeMeta(opts.meta),
    });
  } catch {
    // ignore
  }
}
