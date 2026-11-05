import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { listPortfolioBusinesses } from "@/lib/master-mentor/portfolio-service";
import { createClient } from "@/lib/supabase/server";
import PortfolioClient from "./portfolio-client";

export default async function PortfolioPage() {
  const owner = await requireMentorOwnerPage();
  const db = await createClient();
  const { rows, notice } = await listPortfolioBusinesses(db, owner.userId);

  return <PortfolioClient initialRows={rows} notice={notice} />;
}
