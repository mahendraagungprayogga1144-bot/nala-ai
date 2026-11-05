export type WorkflowTrigger = "scheduled" | "data_change" | "business_event" | "manual";

export type WorkflowRecord = {
  id: string;
  owner_user_id: string;
  business_id: string | null;
  name: string;
  description: string;
  trigger_type: WorkflowTrigger;
  schedule_cron: string | null;
  timezone: string;
  conditions: Record<string, unknown>;
  actions: unknown[];
  enabled: boolean;
  require_approval: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkflowRun = {
  id: string;
  owner_user_id: string;
  workflow_id: string | null;
  idempotency_key: string;
  trigger_type: string;
  status: "running" | "success" | "failed" | "skipped" | "pending_approval";
  attempt: number;
  started_at: string;
  finished_at: string | null;
  error: string | null;
  result: Record<string, unknown> | null;
  logs: unknown[];
};

export type SmartAlertRow = {
  id: string;
  owner_user_id: string;
  business_id: string | null;
  alert_key: string;
  issue: string;
  severity: string;
  evidence: unknown[];
  recommended_action: string;
  kind: string;
  status: string;
  fingerprint: string;
  first_seen_at: string;
  last_seen_at: string;
  notify_count: number;
  muted_until: string | null;
};

export type IntegrationSettings = {
  owner_user_id: string;
  whatsapp_enabled: boolean;
  whatsapp_provider: "none" | "infobip" | "fonnte";
  whatsapp_notify_owner_only: boolean;
  shopee_enabled: boolean;
  shopee_status: "pending_credentials" | "configured" | "disabled";
  shopee_notes: string;
  sales_automation_enabled: boolean;
  daily_briefing_enabled: boolean;
  weekly_review_enabled: boolean;
  updated_at: string;
};
