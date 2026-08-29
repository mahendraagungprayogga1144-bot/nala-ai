# Henima Sales CRM + Telegram Bot — Implementation Plan

Audit of the existing **Gercep / Nala-Clode** repository, then the additive plan to ship Sales + CRM + Telegram + Reporting on the **same Gercep database**.

---

## 1. Existing architecture

| Layer | Found |
| --- | --- |
| App | Next.js **16.2.9** App Router, React 19, TypeScript, Tailwind 4 |
| Auth | Supabase Auth (`@supabase/ssr`). Login/signup unchanged. `proxy.ts` gates `/dashboard`, `/admin`, `/onboarding` |
| Tenancy | `businesses.user_id` = owner. Active business cookie `active_business_id` |
| Data access | Supabase JS client. **No Prisma / Drizzle.** Dashboard modules mostly query from RSC + browser client |
| Domain helpers | `lib/pos/checkout-product-sale.ts`, `lib/pos/void-retail-sale.ts`, `lib/date.ts` (Asia/Jakarta) |
| API routes | Few, focused (chat, kasir public, admin, trading-ai, invoice, track). No REST sales API yet |
| Design system | Dark shell `#070711`, teal `#2DD4BF`, `MODULE_CARD` / `MODULE_BTN` / `MODULE_INPUT`, `ModuleHeader`, `guardPage` |
| Money | `NUMERIC` + `Math.round` + `toLocaleString("id-ID")` → `Rp199.000` |
| Tests | No Jest/Vitest. Trading-AI uses `npx tsx` + `assert` scripts |
| PDF | HTML print (`lib/payment/invoice.ts`, `app/dashboard/inventory/lib/export-pdf.ts`). No PDF library |
| Telegram | **None.** `module_platform_channels` is a settings list only |
| Scheduler | None required by this module (skipped; no new infra) |

**Rule followed:** extend Gercep in-place. Do not fork a new app, auth, or database.

---

## 2. Existing database (reusable)

Production repair migration (`20260724_core_repair_existing.sql`) is authoritative: **`products.id` may be BIGINT**, `order_items.product_id` is **TEXT**.

### Reuse (do not duplicate)

| Table | Role | Henima use |
| --- | --- | --- |
| `profiles` | Auth profile | Display sales name |
| `businesses` | Tenant | All Henima rows scoped by `business_id` |
| `products` | Inventory + price | Afternoon / The Distance live here; stock decremented on confirm |
| `stock_movements` | Stock audit | `keluar`/`masuk` on confirm/delete |
| `orders` + `order_items` | POS (F&B + AI Kasir) | **Same tables**, distinguished by `source = 'henima_sales'` |
| `transactions` | Finance ledger (`pemasukan` / `pengeluaran`) | Paid Henima orders posted here so Keuangan Bisnis sees omzet |
| `module_crm_customers` | Simple CRM (`nama`, `telepon`, `email`, `alamat`, `catatan`) | **Extended** — not replaced |
| `admin_logs` | Platform admin audit | Left alone (different actor model) |

### Exists but different product — do not overload

| Table | Why not the Henima system |
| --- | --- |
| `module_commission_staff` / `module_commission_sales` | Manual omzet % staff sheet. Keep Tim & Komisi module working |
| `module_platform_channels` | Channel toggle UI, not bot identity |
| `employees` / `retail_kasir_staff` | Kasir PIN / F&B share-link, not Telegram sales RBAC |
| `payments` | Gercep **subscription** payments, not customer order payments |
| `business_members` | Referenced in auth invite code; **no CREATE TABLE in repo migrations** — do not depend on it |

### Storage already in use

`product-photos`, `avatars`, `menu-photos` (public URLs). Testimonials need a **private** bucket.

---

## 3. Existing features (must keep working)

- Inventory, AI Kasir, Kasir F&B, Keuangan, Owner/Analitik, CRM Pelanggan (beta list), Tim & Komisi (beta), Multi Platform (settings), all biz-type modules, Trading AI, admin.

Henima writes to `orders` **only** with `source = 'henima_sales'`. Kasir panels should ignore that source so F&B/retail lists stay kasir-only.

---

## 4. Reusable components

- `getActiveBusiness`, `guardPage`, `ModuleHeader`, module form styles, sidebar `GERCEP_MODULES`
- `createClient` / `createAdminClient` (service role)
- `todayWib()` / Asia/Jakarta
- `checkoutProductSale` / `voidRetailSale` patterns (optimistic stock, compensate on failure)
- In-memory rate limit pattern in `app/api/track/route.ts`
- HTML report styling from inventory export (adapted for PDF)

---

## 5. Required changes (additive)

1. Safe SQL migration (ADD COLUMN / CREATE TABLE IF NOT EXISTS only).
2. Shared domain layer `lib/henima-sales/*` used by **Telegram and Dashboard** (no split business logic).
3. API routes under `/api/sales`, `/api/customers`, `/api/reports`, `/api/telegram/webhook`.
4. Telegram conversation FSM + webhook (token only in env).
5. Dashboard module **Sales Management** + subpages.
6. Server-side PDF (`pdf-lib`) + Telegram document send.
7. Unit tests for money, phone, authz, totals, commission, bot FSM, reports.

---

## 6. New / extended tables

### Extend

- `module_crm_customers`: `whatsapp_phone`, `kota`, `phone_normalized`, `assigned_sales_id`, `status`, purchase aggregates, `updated_at`
- `orders`: `customer_id`, `sales_id`, `payment_status`, `deleted_at`, `idempotency_key` (`source` already exists)
- `order_items`: `product_name_snapshot`
- `transactions`: `ref_order_id` (link finance row for reverse on soft-delete)

### New (`module_sales_*`)

| Table | Purpose |
| --- | --- |
| `module_sales_staff` | FOUNDER / LEADER / SALES, `telegram_user_id`, `leader_id`, invite code, `user_id` |
| `module_sales_follow_ups` | CRM reminders |
| `module_sales_testimonials` | Storage path + caption + customer/order/sales |
| `module_sales_targets` | daily / weekly / monthly, per staff, configurable |
| `module_sales_commission_rules` | fixed + %, product/role/staff, effective dates |
| `module_sales_commission_ledger` | computed per order (not hardcoded UI) |
| `module_sales_audit_logs` | entity audit (no secrets / full phones) |
| `module_sales_telegram_sessions` | bot FSM state |
| `module_sales_telegram_updates` | webhook idempotency (`update_id`) |

Atomic confirm/edit/delete via `SECURITY DEFINER` RPCs, **REVOKE from PUBLIC/anon/authenticated**, execute as `service_role` only.

---

## 7. New APIs

All mutate/read through services + **server-side** RBAC (Founder = all, Leader = team, Sales = own).

| Method | Path |
| --- | --- |
| CRUD | `/api/sales/orders`, `/api/sales/orders/:id` |
| CRUD | `/api/customers`, `/api/customers/:id` |
| GET/PATCH | `/api/sales/follow-ups`, `/api/sales/testimonials`, `/api/sales/targets`, `/api/sales/commissions`, `/api/sales/staff` |
| GET | `/api/reports/sales` |
| POST | `/api/reports/pdf` |
| POST | `/api/telegram/webhook` |
| POST | `/api/telegram/setup` (founder sets webhook) |

---

## 8. Telegram architecture

```
Sales ↔ Telegram Bot ↔ Webhook /api/telegram/webhook
                         → lib/henima-sales services
                         → Gercep Postgres + Storage
Dashboard (henimaofficial.com) → same services
```

- Identity: `telegram_user_id` (never username alone).
- Unlinked: _"Telegram Anda belum terdaftar. Hubungi admin Henima."_
- Invite: founder generates code; `/start CODE` links the account.
- Photos: Telegram `file_id` → download → private bucket `testimonials/YYYY/MM/{customer}/{order}/`
- Double confirm: `idempotency_key` unique per business.
- Rate limit per Telegram user; secret header `X-Telegram-Bot-Api-Secret-Token`.

Commands: `/start` `/input` `/riwayat` `/customer` `/rekap` `/target` `/followup` `/pdf` `/help`

---

## 9. Security considerations

- Authorization **only** in services (not hidden UI).
- IDOR: every order/customer/follow-up load checks `business_id` + role scope.
- RLS on new tables: owner-by-business; staff/Telegram use service role after authz.
- Testimonials bucket **not public**; signed URLs from API.
- Mask phones in logs (`0812****1234`).
- Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` — never commit.
- Pending payments **do not** count as revenue, pcs, commission, or target.
- Soft-deleted orders excluded from all normal reports; founder can still list them via audit/admin filter.

---

## 10. Implementation plan

| Step | Status |
| --- | --- |
| 1 Audit (this file) | Done |
| 2 Database migration | Next |
| 3 Domain services | |
| 4 API | |
| 5 Telegram bot | |
| 6 Dashboard | |
| 7 PDF | |
| 8 Tests + typecheck/lint/build | |
| 9 Security review | |
| 10 Final review (existing Gercep intact) | |

### Business rules (confirm path)

1. Find or create customer (phone unique per business).
2. Authenticated sales/staff.
3. Valid product, qty > 0, price ≥ 0, total server-side.
4. Commission from **active rule on order date**.
5. Stock decrement if product has stock tracking (never negative).
6. Single DB transaction (RPC).
7. Audit log.
8. Telegram confirmation + dashboard immediately reads same rows.

### Roles

| Role | Scope |
| --- | --- |
| FOUNDER | Business owner (auto-provisioned) + optional extra founders — all data |
| LEADER | Customers/orders/targets/commission/ranking for **self + sales where leader_id = self** |
| SALES | Own customers, orders, testimonials, targets, commission, follow-ups only |

---

## 11. Go-live (ops)

1. Run `supabase/migrations/20260829_henima_sales_crm.sql` then `supabase/migrations/20260829_henima_sales_settings.sql` (nama bisnis modul, terpisah dari tenant Gercep).
2. Set env (Vercel / `.env.local`) — **do not commit**:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET` (random string, also used as Telegram `secret_token`)
   - `SUPABASE_SERVICE_ROLE_KEY` (already required by Gercep)
3. Open **Henima Sales → Settings** as business owner (auto-created as FOUNDER). Edit **nama bisnis modul** (bukan nama tenant `g`).
4. **Seed Afternoon / The Distance** if those products are not in Inventory yet. Set harga jual di Inventory (tidak di-hardcode).
5. Undang sales/leader → kirim kode. Sales di Telegram: `/start KODE`.
6. **Set Telegram webhook** (tombol di Settings) ke `https://<domain>/api/telegram/webhook`.
7. Tambah aturan komisi dan target (configurable).

Revenue rule: hanya `payment_status = PAID` dan `deleted_at IS NULL` yang masuk omzet, pcs, komisi, target, PDF.

---

## 12. Verification (2026-08-29)

- `npx tsc --noEmit` — pass
- eslint on new sales files — pass
- `npx tsx lib/henima-sales/tests/run.ts` — pass
- `npx next build` — pass (sales routes dynamic `ƒ`)

Audit schema ([Audit core database schema](c44ec411-d6b7-4838-910c-b922189425c3)) and architecture ([Audit app architecture auth](e09ded94-cccc-4e6d-99f3-025951e83fc6)) match this plan: reuse `orders` / `module_crm_customers` / `products`; do not overload SaaS `payments` or Tim & Komisi tables; Telegram via webhook + service role. `business_members` remains unused here — sales RBAC is `module_sales_staff`. Webhook failures write to existing `app_errors`.

