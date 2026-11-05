import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/master-mentor/automation/cron-auth";
import { runAlertsAndIntegrationsJob } from "@/lib/master-mentor/automation/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;
  const result = await runAlertsAndIntegrationsJob();
  return NextResponse.json(result);
}
