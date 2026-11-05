import { NextResponse } from "next/server";
import { withMentorOwner } from "@/lib/master-mentor/authz";
import { buildBriefingsForOwner } from "@/lib/master-mentor/automation/briefing";
import { buildSalesMonitorForOwner } from "@/lib/master-mentor/automation/sales-monitor";
import {
  getIntegrationSettings,
  upsertIntegrationSettings,
} from "@/lib/master-mentor/automation/settings";
import { listSmartAlerts, muteSmartAlert, syncSmartAlertsForOwner } from "@/lib/master-mentor/automation/smart-alerts";
import {
  listWorkflowRuns,
  listWorkflows,
  parseWorkflowInput,
  upsertWorkflow,
} from "@/lib/master-mentor/automation/workflow-engine";
import { MentorValidationError } from "@/lib/master-mentor/types";
import { cleanText } from "@/lib/master-mentor/text";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    const url = new URL(request.url);
    const view = url.searchParams.get("view") || "overview";

    if (view === "workflows") {
      const { rows, notice } = await listWorkflows(db, owner.userId);
      return { view, workflows: rows, notice };
    }
    if (view === "runs") {
      const { rows, notice } = await listWorkflowRuns(db, owner.userId);
      return { view, runs: rows, notice };
    }
    if (view === "alerts") {
      const status = url.searchParams.get("status") || "open";
      const { rows, notice } = await listSmartAlerts(db, owner.userId, status);
      return { view, alerts: rows, notice };
    }
    if (view === "sales") {
      const reports = await buildSalesMonitorForOwner(db, owner.userId);
      return { view, reports };
    }
    if (view === "briefing") {
      const kind = url.searchParams.get("kind") === "weekly" ? "weekly" : "daily";
      const briefings = await buildBriefingsForOwner(db, owner.userId, kind);
      return { view, kind, briefings };
    }
    if (view === "settings") {
      return { view, ...(await getIntegrationSettings(db, owner.userId)) };
    }

    const [settings, workflows, alerts, runs] = await Promise.all([
      getIntegrationSettings(db, owner.userId),
      listWorkflows(db, owner.userId),
      listSmartAlerts(db, owner.userId, "open"),
      listWorkflowRuns(db, owner.userId),
    ]);
    return {
      view: "overview",
      settings: settings.settings,
      probes: settings.probes,
      notice: settings.notice || workflows.notice || alerts.notice || runs.notice,
      workflowCount: workflows.rows.length,
      openAlerts: alerts.rows.length,
      recentRuns: runs.rows.slice(0, 10),
    };
  });
}

export async function POST(request: Request) {
  return withMentorOwner(async ({ owner, db }) => {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON tidak valid." }, { status: 400 });
    }
    const op = cleanText(body.op, 40);

    try {
      if (op === "save_settings") {
        const settings = await upsertIntegrationSettings(db, owner.userId, body.settings || body);
        return { settings };
      }
      if (op === "upsert_workflow") {
        const input = parseWorkflowInput(body.workflow || body);
        const id = cleanText(body.id, 80) || undefined;
        const workflow = await upsertWorkflow(db, owner.userId, input, id);
        return { workflow };
      }
      if (op === "sync_alerts") {
        const result = await syncSmartAlertsForOwner(db, owner.userId);
        return result;
      }
      if (op === "mute_alert") {
        await muteSmartAlert(db, owner.userId, cleanText(body.id, 80), Number(body.hours) || 24);
        return { ok: true };
      }
      return NextResponse.json({ error: "op tidak dikenali." }, { status: 400 });
    } catch (err) {
      if (err instanceof MentorValidationError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
      }
      throw err;
    }
  });
}
