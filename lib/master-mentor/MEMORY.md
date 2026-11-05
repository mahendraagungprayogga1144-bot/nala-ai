# HENIMA AI — Phase 2 Business Memory Engine

## Architecture

```
Owner (authz) → Memory APIs → PostgreSQL tables (RLS owner-scoped)
                           ↘ retrieveMentorContext() → MentorContextPack
```

Memory kinds: owner · business · financial · decision · strategy · learning  
Automatic Memory: `memory_candidates` (pending → approve/reject/correct)

## Why not pgvector

No pgvector extension or embedding stack exists in this repo. Phase 2 memory is structured owner-authored data. Keyword + filtered SQL retrieval is sufficient and safer (no hallucinated embeddings). Re-evaluate in Phase 3 if semantic chat retrieval is required.

## Isolation

Every business-scoped row carries `business_id` FK → `module_master_mentor_businesses` and `owner_user_id`. Services call `assertOwnedBusiness` before write. Cross-business mixes are rejected.

## Non-goals (Phase 2)

- No AI generation of financial numbers
- No auto-commit of chat content as fact
- No framework / auth / Gercep module rewrites
