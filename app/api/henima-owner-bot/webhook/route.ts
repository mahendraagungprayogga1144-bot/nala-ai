import { after, NextResponse } from "next/server";
import { salesDb } from "@/lib/henima-sales/db";
import { ownerBotConfigured, ownerBotSecretOk } from "@/lib/henima-tracking/owner-bot";
import { handleOwnerBotUpdate } from "@/lib/henima-tracking/owner-bot-handler";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!ownerBotConfigured()) {
    return NextResponse.json({ error: "Owner bot not configured" }, { status: 503 });
  }
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!ownerBotSecretOk(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: { update_id?: number };
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!update?.update_id) return NextResponse.json({ ok: true });

  after(async () => {
    try {
      await handleOwnerBotUpdate(salesDb(), update);
    } catch {
      /* swallow — Telegram retry kalau perlu */
    }
  });
  return NextResponse.json({ ok: true });
}
