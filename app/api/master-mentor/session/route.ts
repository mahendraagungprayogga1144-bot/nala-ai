import { withMentorOwner } from "@/lib/master-mentor/authz";
import { getMentorProviderConfig } from "@/lib/master-mentor/providers/config";
import { MENTOR_PERMISSIONS } from "@/lib/master-mentor/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  return withMentorOwner(async ({ owner }) => {
    const cfg = getMentorProviderConfig();
    return {
      owner: {
        name: owner.ownerName,
        email: owner.email,
        activeGercepBusinessId: owner.activeGercepBusinessId,
        gercepBusinesses: owner.gercepBusinesses,
      },
      engine: {
        status: cfg.apiKeyPresent ? "ready" : "awaiting_api_key",
        phase: 3,
        provider: cfg.provider,
        model: cfg.model,
        apiKeyConfigured: cfg.apiKeyPresent,
        permissions: MENTOR_PERMISSIONS,
        message: cfg.apiKeyPresent
          ? "Master Orchestrator ready. Analysis-only permissions."
          : "Set ANTHROPIC_API_KEY on the server to enable Mentor Chat intelligence.",
        retrieval: "/api/master-mentor/memory/retrieve",
        chat: "/api/master-mentor/chat",
        pgvector: false,
      },
    };
  });
}
