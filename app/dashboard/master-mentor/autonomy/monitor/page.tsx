import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import AutonomyDesk from "../autonomy-desk";

export default async function AutonomyMonitorPage() {
  await requireMentorOwnerPage();
  return (
    <AutonomyDesk
      view="monitor"
      title="Execution Monitor"
      subtitle="Active, pending approval, completed, failed, cost & latency."
      businesses={[]}
    />
  );
}
