import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { listBusinessMemory } from "@/lib/master-mentor/business-memory-service";
import { listDecisions } from "@/lib/master-mentor/decision-memory-service";
import { createClient } from "@/lib/supabase/server";
import DecisionsClient from "./decisions-client";

export default async function DecisionsMemoryPage() {
  const owner = await requireMentorOwnerPage();
  const db = await createClient();
  const { rows: businesses } = await listBusinessMemory(db, owner.userId);
  const first = businesses[0]?.id;
  const { rows, notice } = await listDecisions(db, owner.userId, {
    businessId: first,
  });
  return (
    <DecisionsClient
      businesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
      initial={rows}
      notice={notice}
    />
  );
}
