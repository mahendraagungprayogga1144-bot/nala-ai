import { withMentorOwner } from "@/lib/master-mentor/authz";

export const dynamic = "force-dynamic";

/** Lightweight owner session probe — no AI, no secrets. */
export async function GET() {
  return withMentorOwner(async ({ owner }) => ({
    owner: {
      name: owner.ownerName,
      email: owner.email,
      activeGercepBusinessId: owner.activeGercepBusinessId,
      gercepBusinesses: owner.gercepBusinesses,
    },
    engine: {
      status: "memory_ready",
      phase: 2,
      message:
        "Business Memory Engine is available. AI orchestration connects in Phase 3. Retrieval uses structured PostgreSQL memory — no invented facts.",
      retrieval: "/api/master-mentor/memory/retrieve",
      pgvector: false,
    },
  }));
}
