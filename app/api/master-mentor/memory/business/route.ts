import { withMentorOwner } from "@/lib/master-mentor/authz";
import { listBusinessMemory } from "@/lib/master-mentor/business-memory-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    const q = new URL(request.url).searchParams.get("q") || undefined;
    const { rows, notice } = await listBusinessMemory(db, owner.userId, q);
    return { businesses: rows, notice };
  });
}
