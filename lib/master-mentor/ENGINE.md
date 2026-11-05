# HENIMA AI Phase 3 — Master Mentor Intelligence Engine

## Architecture

```
Owner Chat UI
  → POST /api/master-mentor/chat (SSE)
  → runMasterOrchestrator
       → retrieveMentorContext (Phase 2)
       → planSpecialistRoute (selective)
       → domain specialists (Strategy/CFO/Growth/Operations/Risk) as needed
       → Chairman synthesizes final answer
       → usage logs + conversation persistence
```

## Permissions

READ + ANALYZE only. WRITE / financial transactions / external messages disabled.

## Provider

Abstraction in `providers/`. Default Anthropic via `ANTHROPIC_API_KEY`.
Switch with `MASTER_MENTOR_PROVIDER` / `MASTER_MENTOR_MODEL`. Never commit secrets.

## Hallucination controls

- Memory pack includes `missing[]`
- CFO uses `buildFinanceSnapshot` from owner financial records only
- Prompts forbid inventing numbers
- Specialist activity UI only shows agents that actually ran
