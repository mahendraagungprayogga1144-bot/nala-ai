import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import AutonomyDesk from "../autonomy-desk";

export default async function AutonomyToolsPage() {
  await requireMentorOwnerPage();
  return (
    <AutonomyDesk
      view="tools"
      title="Tool Registry"
      subtitle="Daftar tools internal yang boleh dipanggil Autonomous Assistant."
      businesses={[]}
    />
  );
}
