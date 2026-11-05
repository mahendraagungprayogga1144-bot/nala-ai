import type { SupabaseClient } from "@supabase/supabase-js";
import { MentorValidationError } from "../types";
import { cleanText, isMissingTable } from "../text";
import type { IntegrationSettings } from "./types";
import { probeShopeeCapability } from "./shopee-adapter";
import { probeWhatsAppCapability } from "./whatsapp-adapter";

const TABLE = "module_master_mentor_integration_settings";

export async function getIntegrationSettings(
  db: SupabaseClient,
  ownerUserId: string,
): Promise<{ settings: IntegrationSettings | null; notice: string | null; probes: unknown }> {
  const { data, error } = await db.from(TABLE).select("*").eq("owner_user_id", ownerUserId).maybeSingle();
  if (error) {
    if (isMissingTable(error, TABLE)) {
      return {
        settings: null,
        notice: "Tabel integration settings belum aktif. Jalankan migration Phase 6.",
        probes: { whatsapp: probeWhatsAppCapability(), shopee: probeShopeeCapability() },
      };
    }
    return { settings: null, notice: error.message, probes: {} };
  }
  return {
    settings: (data as IntegrationSettings) || null,
    notice: null,
    probes: { whatsapp: probeWhatsAppCapability(), shopee: probeShopeeCapability() },
  };
}

export async function upsertIntegrationSettings(
  db: SupabaseClient,
  ownerUserId: string,
  body: unknown,
): Promise<IntegrationSettings> {
  if (!body || typeof body !== "object") throw new MentorValidationError("Payload tidak valid.");
  const raw = body as Record<string, unknown>;
  const patch = {
    owner_user_id: ownerUserId,
    whatsapp_enabled: Boolean(raw.whatsapp_enabled),
    whatsapp_provider: cleanText(raw.whatsapp_provider || "none", 20) || "none",
    whatsapp_notify_owner_only: raw.whatsapp_notify_owner_only !== false,
    shopee_enabled: Boolean(raw.shopee_enabled),
    shopee_status: cleanText(raw.shopee_status || "pending_credentials", 40),
    shopee_notes: cleanText(raw.shopee_notes, 2000),
    sales_automation_enabled: raw.sales_automation_enabled !== false,
    daily_briefing_enabled: raw.daily_briefing_enabled !== false,
    weekly_review_enabled: raw.weekly_review_enabled !== false,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db.from(TABLE).upsert(patch).select("*").single();
  if (error) {
    if (isMissingTable(error, TABLE)) {
      throw new MentorValidationError("Tabel integration settings belum aktif.");
    }
    throw new MentorValidationError(error.message || "Gagal menyimpan settings.");
  }
  return data as IntegrationSettings;
}
