export const AUTONOMY_LEVELS = [0, 1, 2, 3] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const AUTONOMY_LEVEL_LABELS: Record<AutonomyLevel, string> = {
  0: "Read Only",
  1: "Prepare",
  2: "Approval Required",
  3: "Limited Autonomy",
};

export const TASK_STATUSES = [
  "pending",
  "planning",
  "waiting_approval",
  "approved",
  "executing",
  "verifying",
  "completed",
  "rejected",
  "failed",
  "cancelled",
  "paused",
  "expired",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STEP_STATUSES = [
  "pending",
  "running",
  "waiting_approval",
  "completed",
  "failed",
  "skipped",
  "cancelled",
] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type AutoTask = {
  id: string;
  owner_user_id: string;
  business_id: string | null;
  goal: string;
  priority: TaskPriority;
  risk_level: string;
  permission_level: AutonomyLevel;
  status: TaskStatus;
  plan: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_log: string;
  idempotency_key: string;
  token_usage: Record<string, unknown>;
  started_at: string | null;
  finished_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type AutoStep = {
  id: string;
  owner_user_id: string;
  task_id: string;
  step_index: number;
  title: string;
  tool_name: string;
  specialist: string;
  status: StepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error_log: string;
  linked_action_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AutonomySettings = {
  owner_user_id: string;
  autonomy_level: AutonomyLevel;
  emergency_stop: boolean;
  allowed_level3_tools: string[];
  max_concurrent_tasks: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type PlannedStep = {
  title: string;
  tool_name: string;
  specialist?: string;
  input?: Record<string, unknown>;
};

export type TaskPlan = {
  summary: string;
  permission_level: AutonomyLevel;
  risk_level: string;
  steps: PlannedStep[];
};

export function isTaskStatus(v: string): v is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(v);
}

export function isAutonomyLevel(v: unknown): v is AutonomyLevel {
  return v === 0 || v === 1 || v === 2 || v === 3;
}
