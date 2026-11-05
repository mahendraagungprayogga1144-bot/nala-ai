import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import AutomationDesk from "../automation-desk";

export default async function Page() {
  await requireMentorOwnerPage();
  return (
    <AutomationDesk
      view="whatsapp"
      title="WhatsApp Integration"
      subtitle="Infobip resmi + draft approval"
    />
  );
}
