import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { listPortfolioBusinesses } from "@/lib/master-mentor/portfolio-service";
import { createClient } from "@/lib/supabase/server";
import AutonomyDesk from "../autonomy-desk";

export default async function AutonomyPlannerPage() {
  const owner = await requireMentorOwnerPage();
  const db = await createClient();
  const { rows } = await listPortfolioBusinesses(db, owner.userId);
  return (
    <AutonomyDesk
      view="planner"
      title="Task Planner"
      subtitle="Ubah perintah owner menjadi rencana langkah terdaftar."
      businesses={rows.map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
