import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import {
  cancelAutoTask,
  getAutoTask,
  pauseAutoTask,
  resumeAutoTask,
  runAutoTask,
  transitionTask,
} from "@/lib/master-mentor/autonomy";
import { registerBuiltinTools } from "@/lib/master-mentor/autonomy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withMentorOwner(async ({ owner, db }) => {
    const data = await getAutoTask(db, owner.userId, id);
    if (!data.task) return NextResponse.json({ error: "Task tidak ditemukan." }, { status: 404 });
    return data;
  });
}

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withMentorOwner(async ({ owner, db }) => {
    registerBuiltinTools();
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    const action = String(body.action || "run");

    if (action === "cancel") {
      const task = await cancelAutoTask(db, owner.userId, id);
      return { ok: true, task };
    }
    if (action === "pause") {
      const task = await pauseAutoTask(db, owner.userId, id);
      return { ok: true, task };
    }
    if (action === "resume") {
      const run = await resumeAutoTask(db, owner.userId, id);
      return { ok: true, run };
    }
    if (action === "continue_after_approval") {
      const detail = await getAutoTask(db, owner.userId, id);
      for (const step of detail.steps) {
        if (step.status === "waiting_approval") {
          const { updateStep } = await import("@/lib/master-mentor/autonomy/task-service");
          await updateStep(db, owner.userId, step.id, {
            status: "completed",
            error_log: "Owner lanjut setelah review Approval Center.",
            finished_at: new Date().toISOString(),
          });
        }
      }
      if (detail.task?.status === "waiting_approval") {
        await transitionTask(db, owner.userId, id, "approved");
      }
      const run = await runAutoTask(db, owner.userId, id);
      return { ok: true, run };
    }
    // default run
    const run = await runAutoTask(db, owner.userId, id);
    return { ok: true, run };
  });
}
