import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/master-mentor/automation/cron-auth";
import { runWeeklyReviewJob } from "@/lib/master-mentor/automation/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;
  const result = await runWeeklyReviewJob();
  return NextResponse.json(result);
}
