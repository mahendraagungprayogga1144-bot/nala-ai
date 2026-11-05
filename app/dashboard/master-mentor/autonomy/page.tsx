import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { listPortfolioBusinesses } from "@/lib/master-mentor/portfolio-service";
import { createClient } from "@/lib/supabase/server";
import AutonomyDesk from "./autonomy-desk";

export default async function AutonomyAssistantPage() {
  const owner = await requireMentorOwnerPage();
  const db = await createClient();
  const { rows } = await listPortfolioBusinesses(db, owner.userId);
  return (
    <AutonomyDesk
      view="assistant"
      title="Autonomous Assistant"
      subtitle="Asisten eksekusi terkontrol — tool registry + approval. Default read-only."
      businesses={rows.map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
