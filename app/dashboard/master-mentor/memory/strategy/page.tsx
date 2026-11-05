import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { listBusinessMemory } from "@/lib/master-mentor/business-memory-service";
import { listStrategies } from "@/lib/master-mentor/strategy-memory-service";
import { createClient } from "@/lib/supabase/server";
import StrategyClient from "./strategy-client";

export default async function StrategyMemoryPage() {
  const owner = await requireMentorOwnerPage();
  const db = await createClient();
  const { rows: businesses } = await listBusinessMemory(db, owner.userId);
  const first = businesses[0]?.id;
  const { rows, notice } = await listStrategies(db, owner.userId, { businessId: first });
  return (
    <StrategyClient
      businesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
      initial={rows}
      notice={notice}
    />
  );
}
