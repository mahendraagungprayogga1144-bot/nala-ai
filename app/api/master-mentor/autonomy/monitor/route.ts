import { withMentorOwner } from "@/lib/master-mentor/authz";
import { listAutoTasks, listToolRuns, getAutonomySettings } from "@/lib/master-mentor/autonomy";
import { sumUsage } from "@/lib/master-mentor/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  return withMentorOwner(async ({ owner, db }) => {
    const [{ rows: tasks, notice }, { rows: toolRuns }, { row: settings }] = await Promise.all([
      listAutoTasks(db, owner.userId),
      listToolRuns(db, owner.userId, 40),
      getAutonomySettings(db, owner.userId),
    ]);

    const counts = {
      active: tasks.filter((t) =>
        ["pending", "planning", "approved", "executing", "verifying", "paused"].includes(t.status),
      ).length,
      waiting_approval: tasks.filter((t) => t.status === "waiting_approval").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      failed: tasks.filter((t) => t.status === "failed").length,
    };

    const finished = tasks.filter((t) => t.started_at && t.finished_at);
    const avgMs =
      finished.length === 0
        ? null
        : Math.round(
            finished.reduce(
              (a, t) => a + (new Date(t.finished_at!).getTime() - new Date(t.started_at!).getTime()),
              0,
            ) / finished.length,
          );

    // Token usage from task.token_usage blobs (usually empty until LLM planner added)
    const usageParts = tasks
      .map((t) => t.token_usage)
      .filter((u) => u && typeof u === "object") as {
      inputTokens?: number;
      outputTokens?: number;
      estimatedCostUsd?: number;
      provider?: string;
      model?: string;
    }[];

    let tokenUsage = null;
    try {
      if (usageParts.length) {
        tokenUsage = sumUsage(
          usageParts.map((u) => ({
            inputTokens: Number(u.inputTokens) || 0,
            outputTokens: Number(u.outputTokens) || 0,
            estimatedCostUsd: Number(u.estimatedCostUsd) || 0,
            provider: String(u.provider || "n/a"),
            model: String(u.model || "n/a"),
          })),
        );
      }
    } catch {
      tokenUsage = null;
    }

    return {
      settings,
      counts,
      avgExecutionMs: avgMs,
      tokenUsage,
      recentTasks: tasks.slice(0, 20),
      recentToolRuns: toolRuns.slice(0, 20),
      notice,
    };
  });
}
