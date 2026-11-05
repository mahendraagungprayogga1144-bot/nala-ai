import type { SupabaseClient } from "@supabase/supabase-js";
import { proposeAction } from "../actions/action-service";
import {
  infobipConfigured,
  infobipMonitorReady,
  notifyFounderWhatsApp,
} from "@/lib/henima-sales/whatsapp/infobip";
import { cleanText, isMissingTable } from "../text";

export type WhatsAppCapability = {
  available: boolean;
  provider: "none" | "infobip" | "fonnte";
  canSendOwnerNotify: boolean;
  canSendCustomer: boolean;
  notes: string[];
};

/** Official-path capability probe — never claims Meta Cloud API unless Infobip is configured. */
export function probeWhatsAppCapability(): WhatsAppCapability {
  const notes: string[] = [];
  if (infobipMonitorReady()) {
    notes.push("Infobip WhatsApp Business (CPaaS) siap untuk notifikasi owner (INFOBIP_WA_TO).");
    return {
      available: true,
      provider: "infobip",
      canSendOwnerNotify: true,
      canSendCustomer: false,
      notes: [
        ...notes,
        "Customer broadcast tidak diaktifkan di Phase 6 tanpa approval + policy eksplisit.",
      ],
    };
  }
  if (infobipConfigured()) {
    notes.push("Infobip terkonfigurasi sebagian — set INFOBIP_WA_FROM + INFOBIP_WA_TO untuk owner notify.");
  }
  notes.push("Fonnte device API tersedia di modul Office terpisah; Mentor Automation default ke Infobip resmi.");
  notes.push("Tidak memakai unofficial WhatsApp automation.");
  return {
    available: false,
    provider: "none",
    canSendOwnerNotify: false,
    canSendCustomer: false,
    notes,
  };
}

export async function createWhatsAppDraft(
  db: SupabaseClient,
  ownerUserId: string,
  opts: { body: string; to?: string; meta?: Record<string, unknown> },
) {
  const body = cleanText(opts.body, 4000);
  if (!body) return null;

  const action = await proposeAction(db, ownerUserId, {
    action_type: "external_message_draft",
    title: "WhatsApp draft — butuh approval owner",
    description: body.slice(0, 1500),
    expected_impact: "Pesan tidak dikirim sampai disetujui di Approval Center.",
    risk_level: "high",
    requested_permissions: ["EXTERNAL_MESSAGE"],
    payload: { channel: "whatsapp", to: opts.to || "", body },
    evidence: [],
    source: "system",
  });

  const { data, error } = await db
    .from("module_master_mentor_message_drafts")
    .insert({
      owner_user_id: ownerUserId,
      channel: "whatsapp",
      direction: "outbound",
      to_address: cleanText(opts.to || "", 80),
      body,
      status: "pending_approval",
      action_id: action.id,
      meta: opts.meta || {},
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingTable(error, "module_master_mentor_message_drafts")) return { action, draft: null };
    return { action, draft: null };
  }
  return { action, draft: data };
}

/**
 * Send owner notify only after explicit automation flag.
 * Customer messages always go through draft + approval (never auto-send).
 */
export async function sendOwnerWhatsAppNotify(text: string) {
  const cap = probeWhatsAppCapability();
  if (!cap.canSendOwnerNotify) {
    return { ok: false as const, reason: "whatsapp_owner_notify_unavailable", notes: cap.notes };
  }
  await notifyFounderWhatsApp(text.slice(0, 3500));
  return { ok: true as const };
}
