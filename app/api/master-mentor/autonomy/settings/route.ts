import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  getAutonomySettings,
  parseSettingsBody,
  setEmergencyStop,
  upsertAutonomySettings,
} from "@/lib/master-mentor/autonomy";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return withMentorOwner(async ({ owner, db }) => {
    const { row, notice } = await getAutonomySettings(db, owner.userId);
    return { settings: row, notice };
  });
}

export async function PUT(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON tidak valid." }, { status: 400 });
    }
    const patch = parseSettingsBody(body);
    if (typeof patch.emergency_stop === "boolean" && Object.keys(patch).length === 1) {
      const row = await setEmergencyStop(db, owner.userId, patch.emergency_stop, patch.notes || "");
      return { settings: row };
    }
    const row = await upsertAutonomySettings(db, owner.userId, patch);
    return { settings: row };
  });
}
