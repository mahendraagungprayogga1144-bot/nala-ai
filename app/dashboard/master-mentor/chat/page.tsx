import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { listPortfolioBusinesses } from "@/lib/master-mentor/portfolio-service";
import { createClient } from "@/lib/supabase/server";
import MentorChatClient from "./mentor-chat-client";

export default async function MentorChatPage() {
  const owner = await requireMentorOwnerPage();
  const db = await createClient();
  const { rows } = await listPortfolioBusinesses(db, owner.userId);

  return <MentorChatClient ownerName={owner.ownerName} portfolio={rows} />;
}
