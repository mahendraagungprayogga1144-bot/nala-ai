# HENIMA AI Phase 5 — Decision & Approval Execution

## Goal

Owner-gated action proposals and memory promotion. AI analyzes and proposes; owner approves **one action at a time**; limited memory writes execute after approval. No external sends / ops mutations (those wait for Phase 6 automation).

## Architecture

```
Mentor Chat
  → orchestrator (analyze-only)
  → proposeFromChatTurn
       → module_master_mentor_actions (pending)
       → module_master_mentor_memory_candidates (pending)

Approval Center
  → approve/reject action → executeApprovedAction (memory writes / draft only)
  → approve candidate → promoteApprovedCandidate (canonical memory)
```

## Modules

| Piece | Path |
|-------|------|
| Migration | `supabase/migrations/20261106_master_mentor_phase5_actions.sql` |
| Actions service | `lib/master-mentor/actions/*` |
| Promote candidates | `actions/promote-candidate.ts` |
| Chat wiring | `propose-from-chat.ts` + `app/api/master-mentor/chat/route.ts` |
| API | `/api/master-mentor/actions`, `/actions/[id]`, `/executions` |
| UI | `/dashboard/master-mentor/approvals`, `/executions` |

## Security

- Owner-only (`withMentorOwner` / page gate)
- Expiry on pending actions (default 7 days)
- One approval ≠ blanket permission
- `EXTERNAL_MESSAGE` / finance ops stay draft / memory-only
- Audit logs on propose / approve / reject / execute

## Tests

`npm run test:master-mentor` — includes Phase 5 action parse + risk helpers.

## Deploy

1. Apply `20261106_master_mentor_phase5_actions.sql`
2. Deploy app
3. Use Mentor Chat → open **Approval Center**

## Known limitations

- Chat proposals are heuristic (recommendation + optional decision candidate), not full structured tool-calling
- Owner/business profile candidates still need manual Memory UI merge
- No WhatsApp/Shopee/scheduler yet → Phase 6
- Action retries are single-attempt in v1 (logged; no auto-retry loop)
