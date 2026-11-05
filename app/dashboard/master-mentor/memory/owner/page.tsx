import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { getOwnerMemory } from "@/lib/master-mentor/owner-memory-service";
import { createClient } from "@/lib/supabase/server";
import OwnerMemoryClient from "./owner-memory-client";

export default async function OwnerMemoryPage() {
  const owner = await requireMentorOwnerPage();
  const db = await createClient();
  const { row } = await getOwnerMemory(db, owner.userId);
  return <OwnerMemoryClient initial={row} />;
}
