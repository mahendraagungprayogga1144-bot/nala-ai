import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { listBusinessMemory } from "@/lib/master-mentor/business-memory-service";
import { listLearnings } from "@/lib/master-mentor/learning-memory-service";
import { createClient } from "@/lib/supabase/server";
import LearningClient from "./learning-client";

export default async function LearningMemoryPage() {
  const owner = await requireMentorOwnerPage();
  const db = await createClient();
  const { rows: businesses } = await listBusinessMemory(db, owner.userId);
  const first = businesses[0]?.id;
  const { rows, notice } = await listLearnings(db, owner.userId, { businessId: first });
  return (
    <LearningClient
      businesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
      initial={rows}
      notice={notice}
    />
  );
}
