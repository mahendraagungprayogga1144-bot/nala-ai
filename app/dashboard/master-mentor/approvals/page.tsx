import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import ApprovalsClient from "./approvals-client";

export default async function ApprovalsPage() {
  await requireMentorOwnerPage();
  return <ApprovalsClient />;
}
