import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import ExecutionsClient from "./executions-client";

export default async function ExecutionsPage() {
  await requireMentorOwnerPage();
  return <ExecutionsClient />;
}
