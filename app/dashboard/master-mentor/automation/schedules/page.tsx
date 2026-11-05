import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import AutomationDesk from "../automation-desk";

export default async function Page() {
  await requireMentorOwnerPage();
  return (
    <AutomationDesk
      view="settings"
      title="Scheduled Tasks"
      subtitle="Cron Vercel + toggle briefing/review"
    />
  );
}
