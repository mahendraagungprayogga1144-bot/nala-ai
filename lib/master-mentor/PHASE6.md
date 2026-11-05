# HENIMA AI Phase 6 — Automation & Integration Engine

## Architecture

```
Vercel Cron (UTC → WIB)
  → /api/cron/master-mentor/*  (Bearer CRON_SECRET)
  → service role job runner
  → idempotent workflow_runs
  → briefings / smart alerts / sales monitor
  → optional WhatsApp owner notify + message drafts → Phase 5 Approval Center
```

Timezone: **Asia/Jakarta** (daily 08:00, weekly Mon 09:00, alerts hourly).

## Integrations

| Integration | Status |
|-------------|--------|
| WhatsApp Infobip (owner notify) | **AVAILABLE** if env set |
| WhatsApp customer send | **Draft + approval only** |
| Fonnte | Noted; Mentor default Infobip |
| Shopee Open Platform | **PENDING credentials** — adapter interface only, no scrape |
| Sales automation | **Monitor-only** (no commission/salary mutation) |

## Scheduled jobs

| Cron (UTC) | WIB | Path |
|------------|-----|------|
| `0 1 * * *` | 08:00 | `/api/cron/master-mentor/daily-briefing` |
| `0 2 * * 1` | Senin 09:00 | `/api/cron/master-mentor/weekly-review` |
| `0 * * * *` | setiap jam | `/api/cron/master-mentor/alerts` |

Duplicate prevention: `UNIQUE (owner_user_id, idempotency_key)` on workflow runs.

## UI

`/dashboard/master-mentor/automation/*` — overview, workflows, schedules, WhatsApp, Shopee, alerts, sales, history.

## Security

- Cron auth via `CRON_SECRET` / `MASTER_MENTOR_CRON_SECRET`
- Service role only inside cron jobs
- Owner RLS on all automation tables
- External message requires Phase 5 approval action
- No unofficial WhatsApp; no Shopee scraping

## Deploy

1. Apply `supabase/migrations/20261106_master_mentor_phase6_automation.sql`
2. Set Vercel env: `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (if not already), optional Infobip WA vars
3. Deploy (vercel.json crons register on production)
4. Toggle settings under Automation → Scheduled Tasks / WhatsApp

## Known limitations

- Custom workflow action graph is stored JSON; v1 jobs are built-in (briefing/alerts/sales)
- Shopee sync awaits official credential + endpoint mapping
- WhatsApp customer messaging never auto-sends
- Retry: failed runs logged; no automatic multi-attempt loop yet (attempt column reserved)
