import { withMentorOwner } from "@/lib/master-mentor/authz";
import { getConversation, listMessages } from "@/lib/master-mentor/chat/conversation-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withMentorOwner(async ({ owner, db }) => {
    const { id } = await context.params;
    const conversation = await getConversation(db, owner.userId, id);
    const messages = await listMessages(db, owner.userId, id);
    return { conversation, messages };
  });
}
