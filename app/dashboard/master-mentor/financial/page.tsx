import { redirect } from "next/navigation";
import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { MASTER_MENTOR_BASE } from "@/lib/master-mentor/types";

export default async function FinancialRedirect() {
  await requireMentorOwnerPage();
  redirect(`${MASTER_MENTOR_BASE}/intelligence/financial`);
}
