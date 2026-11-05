import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderUsage } from "./providers/types";

export async function logMentorUsage(
  db: SupabaseClient,
  opts: {
    ownerUserId: string;
    conversationId?: string | null;
    specialist: string;
    usage: ProviderUsage;
    success: boolean;
    errorCode?: string;
  },
) {
  try {
    await db.from("module_master_mentor_usage_logs").insert({
      owner_user_id: opts.ownerUserId,
      conversation_id: opts.conversationId || null,
      provider: opts.usage.provider,
      model: opts.usage.model,
      specialist: opts.specialist,
      input_tokens: opts.usage.inputTokens,
      output_tokens: opts.usage.outputTokens,
      estimated_cost_usd: opts.usage.estimatedCostUsd,
      success: opts.success,
      error_code: opts.errorCode || null,
    });
  } catch (err) {
    console.error("[master-mentor/usage]", err instanceof Error ? err.message : err);
  }
}

export function sumUsage(parts: ProviderUsage[]): ProviderUsage {
  if (!parts.length) {
    return { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, provider: "", model: "" };
  }
  return {
    provider: parts[0].provider,
    model: parts[0].model,
    inputTokens: parts.reduce((a, p) => a + p.inputTokens, 0),
    outputTokens: parts.reduce((a, p) => a + p.outputTokens, 0),
    estimatedCostUsd: parts.reduce((a, p) => a + p.estimatedCostUsd, 0),
  };
}
