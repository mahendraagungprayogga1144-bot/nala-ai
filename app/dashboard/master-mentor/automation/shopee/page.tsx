import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import AutomationDesk from "../automation-desk";

export default async function Page() {
  await requireMentorOwnerPage();
  return (
    <AutomationDesk
      view="shopee"
      title="Shopee Integration"
      subtitle="Adapter interface — no scrape"
    />
  );
}
