import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { listPortfolioBusinesses } from "@/lib/master-mentor/portfolio-service";
import { createClient } from "@/lib/supabase/server";
import IntelligenceDesk from "../intelligence-desk";

export default async function Page() {
  const owner = await requireMentorOwnerPage();
  const db = await createClient();
  const { rows } = await listPortfolioBusinesses(db, owner.userId);
  return (
    <IntelligenceDesk
      module="inventory"
      title="Inventory Intelligence"
      subtitle="Stok, movement, turnover proxy — no auto write"
      portfolio={rows}
    />
  );
}
