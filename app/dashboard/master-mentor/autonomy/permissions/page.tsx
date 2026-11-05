import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import AutonomyDesk from "../autonomy-desk";

export default async function AutonomyPermissionsPage() {
  await requireMentorOwnerPage();
  return (
    <AutonomyDesk
      view="permissions"
      title="Permission Settings"
      subtitle="Autonomy level, level-3 allowlist, emergency stop."
      businesses={[]}
    />
  );
}
