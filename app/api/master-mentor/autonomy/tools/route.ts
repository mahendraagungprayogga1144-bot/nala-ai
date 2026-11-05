import { withMentorOwner } from "@/lib/master-mentor/authz";
import { listToolsPublic, registerBuiltinTools } from "@/lib/master-mentor/autonomy";

export const dynamic = "force-dynamic";

export async function GET() {
  return withMentorOwner(async () => {
    registerBuiltinTools();
    return { tools: listToolsPublic() };
  });
}
