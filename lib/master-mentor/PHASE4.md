# HENIMA AI Phase 4 — Advanced Business Intelligence

## Modules implemented

| Module | Path | Notes |
|--------|------|--------|
| Fact layer | `lib/master-mentor/intelligence/facts.ts` | Read-only Gercep load; Analitik-compatible revenue (tx + retail_kasir) |
| Performance | `performance.ts` + desk | Revenue, orders, AOV, growth, profit |
| Financial | `financial.ts` + desk | P&L, cash flow, margins, break-even proxy, forecast labeled |
| Growth | `growth.ts` + desk | Products, channels, evidence-based opportunities |
| People | `people.ts` + desk | Sales ranking, attendance if tracking exists; no judgment without data |
| Inventory | `inventory.ts` + desk | Stock, movement, turnover proxy, depletion estimate — **no writes** |
| Risk | `risk.ts` + desk | Detected vs hypothesis alerts with severity + action |
| Comparison | `comparison.ts` + desk | Multi-business same period |
| Reports | `reports.ts` + desk | Daily/weekly/monthly/financial/risk text export |
| Mentor wire | `orchestrator/run.ts` + `pack.ts` | Last-30d pack injected into chat context |

## Data sources connected

- `transactions` (scope bisnis)
- `orders` (+ order_items when available)
- `products`, `stock_movements`
- `module_sales_expenses`, `module_sales_staff`
- `module_henima_tracking_points` (soft-fail)
- Portfolio link: `module_master_mentor_businesses.gercep_business_id`

## Endpoints

`GET /api/master-mentor/intelligence?module=...&businessId=...&period=...`

Modules: `performance|financial|growth|people|inventory|risk|comparison|report`

## Dashboard

`/dashboard/master-mentor/intelligence/*` — owner-only, Plus Jakarta shell.

## Tests

`npm run test:master-mentor` — date windows, revenue merge, forecast label, low-stock risk.

## Deployment requirements

1. Apply `supabase/migrations/20261106_master_mentor_phase4_link.sql`
2. Ensure Phase 1–3 mentor migrations already applied
3. Owner must **tautan** portfolio → Gercep business di Business Portfolio
4. No new API keys

## Known limitations

- Conversion rate: not available (no sitewide funnel)
- Working capital: cash-flow proxy only (no full AR/AP)
- Sales target achievement: deferred (targets table not joined in v1 facts)
- Inventory turnover: proxy (current stock value, not average inventory)
- Double-count avoided for Henima via Analitik rule; F&B assumed in transactions
- GPE demo data never used
