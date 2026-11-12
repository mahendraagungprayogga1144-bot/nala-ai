import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/master-mentor/automation/cron-auth";
import { salesDb } from "@/lib/henima-sales/db";
import { ownerBotConfigured } from "@/lib/henima-tracking/owner-bot";
import { runOwnerFieldAlertsJob } from "@/lib/henima-tracking/silent-watch";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;
  if (!ownerBotConfigured()) {
    return NextResponse.json({ ok: false, error: "HENIMA_OWNER_BOT_TOKEN missing" }, { status: 503 });
  }
  const result = await runOwnerFieldAlertsJob(salesDb());
  return NextResponse.json(result);
}
