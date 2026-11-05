import { withMentorOwner } from "@/lib/master-mentor/authz";
import { listExecutions } from "@/lib/master-mentor/actions/execute-action";

export const dynamic = "force-dynamic";

export async function GET() {
  return withMentorOwner(async ({ owner, db }) => {
    const { rows, notice } = await listExecutions(db, owner.userId);
    return { executions: rows, notice };
  });
}
