import type { SupabaseClient } from "@supabase/supabase-js";
import { proposeAction } from "../actions/action-service";
import { buildBriefingsForOwner } from "./briefing";
import { automationIdempotencyKey, jakartaDayKey, jakartaWeekKey } from "./idempotency";
import { buildSalesMonitorForOwner } from "./sales-monitor";
import { syncShopeeIfConfigured } from "./shopee-adapter";
import { syncSmartAlertsForOwner } from "./smart-alerts";
import {
  beginWorkflowRun,
  createAutomationAdminClient,
  finishWorkflowRun,
  listOwnerIdsForAutomation,
} from "./workflow-engine";
import { createWhatsAppDraft, sendOwnerWhatsAppNotify } from "./whatsapp-adapter";

async function getSettings(db: SupabaseClient, ownerUserId: string) {
  const { data } = await db
    .from("module_master_mentor_integration_settings")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  return (
    data || {
      daily_briefing_enabled: true,
      weekly_review_enabled: true,
      sales_automation_enabled: true,
      whatsapp_enabled: false,
      whatsapp_notify_owner_only: true,
    }
  );
}

export async function runDailyBriefingJob() {
  const admin = createAutomationAdminClient();
  if (!admin) return { ok: false, error: "service_role_missing" };
  const owners = await listOwnerIdsForAutomation(admin);
  const day = jakartaDayKey();
  const results: unknown[] = [];

  for (const ownerUserId of owners) {
    const settings = await getSettings(admin, ownerUserId);
    if (settings.daily_briefing_enabled === false) continue;

    const key = automationIdempotencyKey([ownerUserId, "daily_briefing", day]);
    const { run, duplicate } = await beginWorkflowRun(admin, {
      ownerUserId,
      triggerType: "scheduled",
      idempotencyKey: key,
    });
    if (duplicate) {
      results.push({ ownerUserId, status: "skipped_duplicate", runId: run.id });
      continue;
    }

    try {
      const briefings = await buildBriefingsForOwner(admin, ownerUserId, "daily");
      const alerts = await syncSmartAlertsForOwner(admin, ownerUserId);
      const combined = briefings.map((b) => b.text).join("\n\n---\n\n").slice(0, 3500);

      await proposeAction(admin, ownerUserId, {
        action_type: "note_recommendation",
        title: `Daily briefing ${day}`,
        description: combined.slice(0, 2000) || "Tidak ada bisnis aktif untuk briefing.",
        expected_impact: "Ringkasan harian — tidak mengubah data operasional.",
        risk_level: "low",
        requested_permissions: ["READ"],
        payload: { kind: "daily_briefing", day, count: briefings.length },
        evidence: alerts.open.slice(0, 5).map((a) => a.issue),
        source: "system",
      });

      if (settings.whatsapp_enabled && settings.whatsapp_notify_owner_only) {
        await createWhatsAppDraft(admin, ownerUserId, {
          body: `HENIMA Daily Briefing ${day}\n\n${combined.slice(0, 2500)}`,
          meta: { job: "daily_briefing" },
        });
        // Owner notify only if Infobip ready AND enabled — still short summary
        await sendOwnerWhatsAppNotify(
          `HENIMA Daily Briefing ${day}: ${briefings.length} bisnis, ${alerts.open.length} alert terbuka. Detail di Approval Center.`,
        );
      }

      await finishWorkflowRun(admin, ownerUserId, run.id, "success", {
        briefings: briefings.length,
        alerts: alerts.upserted,
      });
      results.push({ ownerUserId, status: "success", briefings: briefings.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "failed";
      await finishWorkflowRun(admin, ownerUserId, run.id, "failed", undefined, msg);
      results.push({ ownerUserId, status: "failed", error: msg });
    }
  }

  return { ok: true, day, results };
}

export async function runWeeklyReviewJob() {
  const admin = createAutomationAdminClient();
  if (!admin) return { ok: false, error: "service_role_missing" };
  const owners = await listOwnerIdsForAutomation(admin);
  const week = jakartaWeekKey();
  const results: unknown[] = [];

  for (const ownerUserId of owners) {
    const settings = await getSettings(admin, ownerUserId);
    if (settings.weekly_review_enabled === false) continue;

    const key = automationIdempotencyKey([ownerUserId, "weekly_review", week]);
    const { run, duplicate } = await beginWorkflowRun(admin, {
      ownerUserId,
      triggerType: "scheduled",
      idempotencyKey: key,
    });
    if (duplicate) {
      results.push({ ownerUserId, status: "skipped_duplicate" });
      continue;
    }

    try {
      const reviews = await buildBriefingsForOwner(admin, ownerUserId, "weekly");
      const sales = settings.sales_automation_enabled
        ? await buildSalesMonitorForOwner(admin, ownerUserId)
        : [];
      const text = reviews.map((r) => r.text).join("\n\n").slice(0, 3500);
      await proposeAction(admin, ownerUserId, {
        action_type: "note_recommendation",
        title: `Weekly review ${week}`,
        description: text.slice(0, 2000),
        expected_impact: "Review mingguan — rekomendasi saja.",
        risk_level: "low",
        requested_permissions: ["READ"],
        payload: { kind: "weekly_review", week, sales },
        source: "system",
      });
      await finishWorkflowRun(admin, ownerUserId, run.id, "success", {
        reviews: reviews.length,
        salesMonitors: sales.length,
      });
      results.push({ ownerUserId, status: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "failed";
      await finishWorkflowRun(admin, ownerUserId, run.id, "failed", undefined, msg);
      results.push({ ownerUserId, status: "failed", error: msg });
    }
  }

  return { ok: true, week, results };
}

export async function runAlertsAndIntegrationsJob() {
  const admin = createAutomationAdminClient();
  if (!admin) return { ok: false, error: "service_role_missing" };
  const owners = await listOwnerIdsForAutomation(admin);
  const day = jakartaDayKey();
  const shopee = await syncShopeeIfConfigured();
  const results: unknown[] = [];

  for (const ownerUserId of owners) {
    // Daily idempotency — Hobby Vercel allows at most one cron run per day.
    const dayKey = automationIdempotencyKey([ownerUserId, "alerts_sync", day]);
    const { run, duplicate } = await beginWorkflowRun(admin, {
      ownerUserId,
      triggerType: "scheduled",
      idempotencyKey: dayKey,
    });
    if (duplicate) {
      results.push({ ownerUserId, status: "skipped_duplicate" });
      continue;
    }
    try {
      const alerts = await syncSmartAlertsForOwner(admin, ownerUserId);
      const sales = await buildSalesMonitorForOwner(admin, ownerUserId);
      await finishWorkflowRun(admin, ownerUserId, run.id, "success", {
        alerts: alerts.upserted,
        sales,
        shopee,
      });
      results.push({ ownerUserId, status: "success", alerts: alerts.upserted });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "failed";
      await finishWorkflowRun(admin, ownerUserId, run.id, "failed", undefined, msg);
      results.push({ ownerUserId, status: "failed", error: msg });
    }
  }

  return { ok: true, shopee, results };
}
