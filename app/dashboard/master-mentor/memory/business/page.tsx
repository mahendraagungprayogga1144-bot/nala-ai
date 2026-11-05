import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { listBusinessMemory } from "@/lib/master-mentor/business-memory-service";
import { createClient } from "@/lib/supabase/server";
import BusinessMemoryClient from "./business-memory-client";

export default async function BusinessMemoryPage() {
  const owner = await requireMentorOwnerPage();
  const db = await createClient();
  const { rows, notice } = await listBusinessMemory(db, owner.userId);
  return <BusinessMemoryClient initial={rows} notice={notice} />;
}
