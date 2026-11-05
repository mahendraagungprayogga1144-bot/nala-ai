import { withMentorOwner } from "@/lib/master-mentor/authz";
import { getMentorProviderConfig } from "@/lib/master-mentor/providers/config";

export const dynamic = "force-dynamic";

/** Owner-only: diagnose Mentor provider without exposing secrets. */
export async function GET() {
  return withMentorOwner(async () => {
    const cfg = getMentorProviderConfig();
    return {
      ok: cfg.provider === "anthropic" ? cfg.apiKeyPresent : cfg.provider === "none",
      provider: cfg.provider,
      model: cfg.model,
      anthropicKeyConfigured: cfg.apiKeyPresent,
      timeoutMs: cfg.timeoutMs,
      maxTokens: cfg.maxTokens,
      hint: cfg.apiKeyPresent
        ? "ANTHROPIC_API_KEY terdeteksi. Kalau chat tetap hang, cek kuota Anthropic / model name."
        : "ANTHROPIC_API_KEY belum ada di Vercel Environment Variables (Production). OpenAI key tidak dipakai Mentor Chat.",
    };
  });
}
