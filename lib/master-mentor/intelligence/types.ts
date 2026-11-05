export type CertaintyLabel = "actual" | "estimate" | "forecast";

export type MetricValue = {
  value: number | null;
  certainty: CertaintyLabel;
  source: string[];
  missing?: string;
};

export type TxFact = {
  business_id: string;
  type: string;
  amount: number;
  category: string | null;
  description: string | null;
  transaction_date: string;
  ref_order_id?: string | null;
};

export type OrderFact = {
  id: string;
  business_id: string;
  total: number;
  laba: number | null;
  hpp: number | null;
  order_date: string;
  source: string | null;
  status: string | null;
  catatan: string | null;
  sales_id: string | null;
  items: {
    product_id: string | null;
    qty: number;
    product_name: string | null;
    harga_jual: number;
    hpp: number | null;
  }[];
};

export type ProductFact = {
  id: string;
  business_id: string;
  name: string;
  stock: number;
  cost: number | null;
  price: number | null;
};

export type StockMoveFact = {
  business_id: string;
  product_id: string | null;
  change: number;
  reason: string | null;
  created_at: string;
};

export type ExpenseFact = {
  business_id: string;
  amount: number;
  category: string | null;
  expense_date: string;
};

export type StaffFact = {
  id: string;
  business_id: string;
  nama: string;
  role: string;
  status: string;
};

export type TrackingPointFact = {
  staff_id: string | null;
  kind: string | null;
  late: boolean | null;
  recorded_at: string;
};

export type BusinessFacts = {
  gercepBusinessId: string;
  gercepBusinessName: string;
  mentorBusinessId: string | null;
  mentorBusinessName: string | null;
  window: { from: string; to: string; label: string; days: number };
  prior: { from: string; to: string; days: number };
  transactions: TxFact[];
  priorTransactions: TxFact[];
  orders: OrderFact[];
  priorOrders: OrderFact[];
  products: ProductFact[];
  stockMoves: StockMoveFact[];
  salesExpenses: ExpenseFact[];
  priorSalesExpenses: ExpenseFact[];
  staff: StaffFact[];
  trackingPoints: TrackingPointFact[];
  notices: string[];
  missingSources: string[];
};

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export type RiskAlert = {
  id: string;
  issue: string;
  supportingData: string[];
  detectionPeriod: string;
  severity: RiskSeverity;
  recommendedAction: string;
  kind: "detected" | "hypothesis";
};

export type IntelligencePack = {
  linked: boolean;
  notices: string[];
  missing: string[];
  performance?: Record<string, unknown>;
  financial?: Record<string, unknown>;
  growth?: Record<string, unknown>;
  inventory?: Record<string, unknown>;
  people?: Record<string, unknown>;
  risks?: RiskAlert[];
};
