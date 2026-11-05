import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  createAutoTask,
  listAutoTasks,
  parseCreateTaskBody,
  runAutoTask,
} from "@/lib/master-mentor/autonomy";
import { registerBuiltinTools } from "@/lib/master-mentor/autonomy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    const url = new URL(request.url);
    const { rows, notice } = await listAutoTasks(db, owner.userId, {
      status: url.searchParams.get("status") || undefined,
      businessId: url.searchParams.get("businessId") || undefined,
    });
    return { tasks: rows, notice };
  });
}

export async function POST(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    registerBuiltinTools();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON tidak valid." }, { status: 400 });
    }
    const input = parseCreateTaskBody(body);
    const autoRun = Boolean((body as { autoRun?: boolean }).autoRun);
    const created = await createAutoTask(db, owner.userId, input);
    if (created.duplicate) {
      return { ok: true, duplicate: true, task: created.task, steps: created.steps };
    }
    if (autoRun) {
      const run = await runAutoTask(db, owner.userId, created.task.id);
      return { ok: true, task: created.task, steps: created.steps, run };
    }
    return { ok: true, task: created.task, steps: created.steps };
  });
}
