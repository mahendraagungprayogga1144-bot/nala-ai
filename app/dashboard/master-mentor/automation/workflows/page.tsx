import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import AutomationDesk from "../automation-desk";

export default async function Page() {
  await requireMentorOwnerPage();
  return (
    <AutomationDesk
      view="workflows"
      title="Workflow Manager"
      subtitle="Definisi workflow, trigger, conditions"
    />
  );
}
