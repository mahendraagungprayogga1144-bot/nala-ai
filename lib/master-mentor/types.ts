export const MASTER_MENTOR_BASE = "/dashboard/master-mentor";

export const BUSINESS_STATUSES = ["draft", "active", "paused", "archived"] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const BUSINESS_CATEGORIES = [
  "perfume",
  "fnb",
  "retail",
  "services",
  "wholesale",
  "online",
  "manufacturing",
  "other",
] as const;
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

export type MentorNavItem = {
  id: string;
  label: string;
  href: string;
  description: string;
  children?: MentorNavItem[];
};

export const MENTOR_NAV: MentorNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    href: MASTER_MENTOR_BASE,
    description: "Briefing and business health",
  },
  {
    id: "chat",
    label: "Mentor Chat",
    href: `${MASTER_MENTOR_BASE}/chat`,
    description: "Consultation desk",
  },
  {
    id: "portfolio",
    label: "Business Portfolio",
    href: `${MASTER_MENTOR_BASE}/portfolio`,
    description: "Manage owned businesses",
  },
  {
    id: "memory",
    label: "Memory",
    href: `${MASTER_MENTOR_BASE}/memory`,
    description: "Business Memory Engine",
    children: [
      {
        id: "memory-owner",
        label: "Owner Profile",
        href: `${MASTER_MENTOR_BASE}/memory/owner`,
        description: "Owner preferences and vision",
      },
      {
        id: "memory-business",
        label: "Business Knowledge",
        href: `${MASTER_MENTOR_BASE}/memory/business`,
        description: "Per-business knowledge profiles",
      },
      {
        id: "memory-financial",
        label: "Financial Records",
        href: `${MASTER_MENTOR_BASE}/memory/financial`,
        description: "Owner-entered financial history",
      },
      {
        id: "memory-decisions",
        label: "Decision History",
        href: `${MASTER_MENTOR_BASE}/memory/decisions`,
        description: "Decisions and outcomes",
      },
      {
        id: "memory-strategy",
        label: "Strategic Plans",
        href: `${MASTER_MENTOR_BASE}/memory/strategy`,
        description: "Strategy and targets",
      },
      {
        id: "memory-learning",
        label: "Learning History",
        href: `${MASTER_MENTOR_BASE}/memory/learning`,
        description: "Lessons from past decisions",
      },
      {
        id: "memory-candidates",
        label: "Pending Approvals",
        href: `${MASTER_MENTOR_BASE}/memory/candidates`,
        description: "Candidate memories awaiting owner approval",
      },
    ],
  },
  {
    id: "strategy",
    label: "Strategy Room",
    href: `${MASTER_MENTOR_BASE}/memory/strategy`,
    description: "Strategy workspace",
  },
  {
    id: "financial",
    label: "Financial Intelligence",
    href: `${MASTER_MENTOR_BASE}/intelligence/financial`,
    description: "Finance insights desk",
  },
  {
    id: "intelligence",
    label: "Business Intelligence",
    href: `${MASTER_MENTOR_BASE}/intelligence`,
    description: "Phase 4 operational analytics",
    children: [
      {
        id: "intel-performance",
        label: "Business Performance",
        href: `${MASTER_MENTOR_BASE}/intelligence/performance`,
        description: "Revenue, orders, growth",
      },
      {
        id: "intel-financial",
        label: "Financial Intelligence",
        href: `${MASTER_MENTOR_BASE}/intelligence/financial`,
        description: "P&L, cash flow, margins",
      },
      {
        id: "intel-growth",
        label: "Growth Analytics",
        href: `${MASTER_MENTOR_BASE}/intelligence/growth`,
        description: "Products and channels",
      },
      {
        id: "intel-people",
        label: "People Analytics",
        href: `${MASTER_MENTOR_BASE}/intelligence/people`,
        description: "Sales and attendance",
      },
      {
        id: "intel-inventory",
        label: "Inventory Intelligence",
        href: `${MASTER_MENTOR_BASE}/intelligence/inventory`,
        description: "Stock and movement",
      },
      {
        id: "intel-risk",
        label: "Risk Monitoring",
        href: `${MASTER_MENTOR_BASE}/intelligence/risk`,
        description: "Detected alerts",
      },
      {
        id: "intel-comparison",
        label: "Business Comparison",
        href: `${MASTER_MENTOR_BASE}/intelligence/comparison`,
        description: "Multi-business compare",
      },
      {
        id: "intel-reports",
        label: "Reports",
        href: `${MASTER_MENTOR_BASE}/intelligence/reports`,
        description: "Daily/weekly/monthly reports",
      },
    ],
  },
  {
    id: "journal",
    label: "Decision Journal",
    href: `${MASTER_MENTOR_BASE}/memory/decisions`,
    description: "Decision log",
  },
  {
    id: "approvals",
    label: "Approval Center",
    href: `${MASTER_MENTOR_BASE}/approvals`,
    description: "Phase 5 owner approvals",
  },
  {
    id: "executions",
    label: "Execution History",
    href: `${MASTER_MENTOR_BASE}/executions`,
    description: "Action execution audit",
  },
  {
    id: "settings",
    label: "AI Settings",
    href: `${MASTER_MENTOR_BASE}/settings`,
    description: "Module preferences",
  },
];

export type MentorPortfolioBusiness = {
  id: string;
  owner_user_id: string;
  name: string;
  category: string;
  description: string;
  status: BusinessStatus;
  targets: string;
  gercep_business_id?: string | null;
  business_model?: string;
  products_services?: string;
  target_customers?: string;
  sales_channels?: string;
  operational_structure?: string;
  business_goals?: string;
  current_challenges?: string;
  created_at: string;
  updated_at: string;
};

export type MentorOwnerContext = {
  userId: string;
  email: string;
  ownerName: string;
  gercepBusinesses: { id: string; name: string; type: string | null }[];
  activeGercepBusinessId: string | null;
};

export class MentorAuthError extends Error {
  readonly httpStatus: number;
  readonly code: string;

  constructor(message: string, httpStatus = 403, code = "forbidden") {
    super(message);
    this.name = "MentorAuthError";
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

export class MentorValidationError extends Error {
  readonly httpStatus = 400;
  readonly code = "validation_error";

  constructor(message: string) {
    super(message);
    this.name = "MentorValidationError";
  }
}

export function isBusinessStatus(value: string): value is BusinessStatus {
  return (BUSINESS_STATUSES as readonly string[]).includes(value);
}

export function isBusinessCategory(value: string): value is BusinessCategory {
  return (BUSINESS_CATEGORIES as readonly string[]).includes(value);
}

export function categoryLabel(category: string) {
  const map: Record<string, string> = {
    perfume: "Perfume / Fragrance",
    fnb: "Food & Beverage",
    retail: "Retail",
    services: "Services",
    wholesale: "Wholesale",
    online: "Online Shop",
    manufacturing: "Manufacturing",
    other: "Other",
  };
  return map[category] || category;
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    draft: "Draft",
    active: "Active",
    paused: "Paused",
    archived: "Archived",
  };
  return map[status] || status;
}
