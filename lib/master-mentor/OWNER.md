# HENIMA AI — Owner-only access (Phase 1)

## How owner is identified

Gercep OS already distinguishes product owners without a dedicated `is_owner` column:

1. **Supabase Auth session** — required for every Master Mentor page and API.
2. **Business ownership** — at least one row in `public.businesses` with `user_id = auth.uid()`.
3. **Kasir exclusion** — if `business_members` marks the user as active `kasir`, access is denied (same idea as `proxy.ts` role lock).

Platform admin `requireOwner()` / email allowlist is **not** used. That gate is for `/admin` only.

## What we did not do

- Did not open the module to all authenticated users as a workaround.
- Did not change existing role permissions for sales, kasir, or admin.
- Did not invent a parallel auth stack.

## Known gap

`business_members` is referenced by `proxy.ts` and this module, but the repo migrations do not contain `CREATE TABLE business_members`. If that table is missing in a given environment, the kasir check safely no-ops and **ownership via `businesses` remains mandatory**. Access is never granted without owned businesses.

## Enforcement points

| Surface | Gate |
|---------|------|
| `app/dashboard/master-mentor/layout.tsx` | `requireMentorOwnerPage()` |
| Each Master Mentor page | `requireMentorOwnerPage()` again |
| `/api/master-mentor/*` | `withMentorOwner()` / `resolveMentorOwner()` |

Unauthorized → `401`. Kasir / non-owner → `403` (pages redirect).
