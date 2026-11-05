import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { listCandidates } from "@/lib/master-mentor/memory-candidates-service";
import { createClient } from "@/lib/supabase/server";
import CandidatesClient from "./candidates-client";

export default async function CandidatesPage() {
  const owner = await requireMentorOwnerPage();
  const db = await createClient();
  const { rows, notice } = await listCandidates(db, owner.userId, "pending");
  return <CandidatesClient initial={rows} notice={notice} />;
}
