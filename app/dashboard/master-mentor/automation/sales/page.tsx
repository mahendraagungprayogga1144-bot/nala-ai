import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import AutomationDesk from "../automation-desk";

export default async function Page() {
  await requireMentorOwnerPage();
  return (
    <AutomationDesk
      view="sales"
      title="Sales Automation"
      subtitle="Monitor target/performance — no write payroll"
    />
  );
}
