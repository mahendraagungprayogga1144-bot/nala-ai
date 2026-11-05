export const FINANCIAL_METRIC_TYPES = [
  "revenue",
  "cogs",
  "gross_profit",
  "operating_expenses",
  "net_profit",
  "cash_inflow",
  "cash_outflow",
  "cash_balance",
  "investment",
  "debt_liabilities",
] as const;
export type FinancialMetricType = (typeof FINANCIAL_METRIC_TYPES)[number];

export const FINANCIAL_CERTAINTIES = ["actual", "estimate", "projection"] as const;
export type FinancialCertainty = (typeof FINANCIAL_CERTAINTIES)[number];

export const FINANCIAL_SOURCES = [
  "owner_entry",
  "import",
  "system",
  "mentor_candidate_approved",
] as const;
export type FinancialSource = (typeof FINANCIAL_SOURCES)[number];

export const DECISION_STATUSES = [
  "proposed",
  "accepted",
  "rejected",
  "in_progress",
  "completed",
  "revisited",
] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const STRATEGY_STATUSES = ["draft", "active", "completed", "paused", "cancelled"] as const;
export type StrategyStatus = (typeof STRATEGY_STATUSES)[number];

export const LEARNING_SOURCES = [
  "owner_entry",
  "decision_review",
  "mentor_candidate_approved",
] as const;
export type LearningSource = (typeof LEARNING_SOURCES)[number];

export const MEMORY_KINDS = [
  "owner",
  "business",
  "financial",
  "decision",
  "strategy",
  "learning",
] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const MEMORY_CLASSIFICATIONS = [
  "fact",
  "preference",
  "assumption",
  "recommendation",
] as const;
export type MemoryClassification = (typeof MEMORY_CLASSIFICATIONS)[number];

export const CANDIDATE_STATUSES = ["pending", "approved", "rejected", "corrected"] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export type OwnerMemory = {
  owner_user_id: string;
  business_vision: string;
  long_term_goals: string;
  communication_style: string;
  decision_preferences: string;
  business_philosophy: string;
  risk_tolerance: string;
  working_preferences: string;
  created_at: string;
  updated_at: string;
};

export type BusinessMemoryProfile = {
  id: string;
  owner_user_id: string;
  name: string;
  category: string;
  description: string;
  status: string;
  targets: string;
  business_model: string;
  products_services: string;
  target_customers: string;
  sales_channels: string;
  operational_structure: string;
  business_goals: string;
  current_challenges: string;
  created_at: string;
  updated_at: string;
};

export type FinancialRecord = {
  id: string;
  owner_user_id: string;
  business_id: string;
  metric_type: FinancialMetricType;
  amount: number;
  currency: string;
  transaction_date: string;
  transaction_category: string;
  description: string;
  data_source: FinancialSource;
  certainty: FinancialCertainty;
  created_at: string;
  updated_at: string;
};

export type DecisionRecord = {
  id: string;
  owner_user_id: string;
  business_id: string;
  title: string;
  description: string;
  reasoning: string;
  alternatives: string;
  expected_outcome: string;
  risks: string;
  decision_date: string;
  status: DecisionStatus;
  actual_outcome: string;
  review_notes: string;
  created_at: string;
  updated_at: string;
};

export type StrategyRecord = {
  id: string;
  owner_user_id: string;
  business_id: string;
  title: string;
  business_strategy: string;
  short_term_targets: string;
  medium_term_targets: string;
  long_term_targets: string;
  growth_plans: string;
  expansion_plans: string;
  marketing_strategies: string;
  operational_strategies: string;
  milestones: string;
  status: StrategyStatus;
  created_at: string;
  updated_at: string;
};

export type LearningRecord = {
  id: string;
  owner_user_id: string;
  business_id: string;
  related_decision_id: string | null;
  lesson: string;
  evidence: string;
  source: LearningSource;
  recorded_date: string;
  created_at: string;
  updated_at: string;
};

export type MemoryCandidate = {
  id: string;
  owner_user_id: string;
  business_id: string | null;
  memory_kind: MemoryKind;
  classification: MemoryClassification;
  proposed_payload: Record<string, unknown>;
  source_ref: string;
  status: CandidateStatus;
  created_at: string;
  reviewed_at: string | null;
  review_note: string;
};

export type RetrievalHit = {
  kind: MemoryKind;
  id: string;
  businessId: string | null;
  title: string;
  excerpt: string;
  source: string;
  updatedAt: string;
};

export type MentorContextPack = {
  query: string;
  businessId: string | null;
  topics: string[];
  owner: OwnerMemory | null;
  business: BusinessMemoryProfile | null;
  decisions: DecisionRecord[];
  financial: FinancialRecord[];
  strategies: StrategyRecord[];
  learnings: LearningRecord[];
  hits: RetrievalHit[];
  missing: string[];
  sourcesUsed: string[];
  note: string;
};

export function metricLabel(m: string) {
  const map: Record<string, string> = {
    revenue: "Revenue",
    cogs: "Cost of Goods Sold",
    gross_profit: "Gross profit",
    operating_expenses: "Operating expenses",
    net_profit: "Net profit",
    cash_inflow: "Cash inflow",
    cash_outflow: "Cash outflow",
    cash_balance: "Cash balance",
    investment: "Investment",
    debt_liabilities: "Debt and liabilities",
  };
  return map[m] || m;
}
