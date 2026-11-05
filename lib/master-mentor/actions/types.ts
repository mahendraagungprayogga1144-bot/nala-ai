export const ACTION_TYPES = [
  "note_recommendation",
  "record_decision",
  "record_strategy",
  "record_learning",
  "financial_memory_write",
  "memory_candidate_promote",
  "inventory_restock_plan",
  "sales_followup_plan",
  "external_message_draft",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "expired",
  "executed",
  "failed",
  "cancelled",
] as const;

export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export type MentorAction = {
  id: string;
  owner_user_id: string;
  business_id: string | null;
  conversation_id: string | null;
  action_type: ActionType;
  title: string;
  description: string;
  business_context: string;
  expected_impact: string;
  risk_level: RiskLevel;
  requested_permissions: string[];
  payload: Record<string, unknown>;
  evidence: unknown[];
  source: string;
  status: ActionStatus;
  expires_at: string;
  reviewed_at: string | null;
  review_note: string;
  executed_at: string | null;
  execution_result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ActionExecution = {
  id: string;
  owner_user_id: string;
  action_id: string;
  attempt: number;
  status: "success" | "failed" | "skipped";
  detail: string;
  result: Record<string, unknown> | null;
  created_at: string;
};

export function isActionType(v: string): v is ActionType {
  return (ACTION_TYPES as readonly string[]).includes(v);
}

export function isRiskLevel(v: string): v is RiskLevel {
  return (RISK_LEVELS as readonly string[]).includes(v);
}
