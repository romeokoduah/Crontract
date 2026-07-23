# Production Follow-ups

Tracked items from the production-readiness audit that require infrastructure, external
keys, or a scheduled upgrade — i.e. things that can't be closed by a code change alone.
Code-level fixes from the audit have already been applied (see git log on
`chore/production-audit`).

## H3 — Next.js 14 → 15 upgrade (security)

**Why:** ~15 residual dependency advisories (DoS, SSRF, cache-poisoning, and a
middleware-bypass class) are only fixed in Next 15. The app uses `middleware.ts` as a
primary auth gate, which the middleware-bypass class directly threatens (partially
mitigated by in-handler `requireAdminRole` checks on admin routes).

**Plan:**
1. Branch `chore/next15-upgrade`. Bump `next`, `eslint-config-next` to 15.x.
2. Address breaking changes: async `cookies()`/`headers()`/`params` APIs, caching default
   changes (`fetch` no longer cached by default), and `next/navigation` updates.
3. Run `pnpm typecheck`, `pnpm build`, full `vitest` suite.
4. Manually verify: auth gate (middleware), payroll post/reverse, file-less flows.
5. Re-run `pnpm audit` and confirm the advisory count drops.

**Interim mitigation:** ensure the deployment topology doesn't expose the middleware-bypass
(keep admin authorization enforced in-handler, which it now is).

## B4 — Distributed rate limiting (Redis)

**Why:** `lib/rate-limit.ts` is in-memory/per-instance. On Vercel or multi-replica K8s,
login brute-force protection is bypassable across instances.

**Status:** A production boot warning now fires when `NODE_ENV=production` and `REDIS_URL`
is unset (`instrumentation.ts`). The `rateLimit()` signature is store-agnostic.

**Plan:** Add an Upstash/Redis-backed store behind the existing `rateLimit()` interface;
gate on `REDIS_URL`. Only required before horizontal scale-out — fine on a single sticky
instance.

## Payroll — current-year GRA tax brackets

**Why:** Only 2024 brackets are seeded. `lib/payroll/rate-loader.ts` now **warns loudly**
when falling back to a prior year instead of doing so silently, but the values are still
2024 figures. Computing current-year pay on 2024 brackets is legally wrong.

**Action:** Enter the current GRA PAYE brackets and SSNIT/relief values for the active tax
year via **Payroll → Tax Settings** (or extend the seed) before running real payroll.

## Email delivery (Resend)

**Status:** `lib/email.ts` now provides a real sending abstraction; team-invitation emails
are wired into onboarding. Without `RESEND_API_KEY` it logs & skips (no-op) so dev/demo
work unchanged.

**Action:** Set `RESEND_API_KEY` + `EMAIL_FROM` and add `resend` to deps to enable live
delivery. Build out: an `/accept-invite` page, email verification, and password reset.

## Other deferred (from audit, not code-fixable here)

- **File uploads** — schema has `storageKey` fields but no storage backend/upload UI. Wire
  S3/MinIO (`S3_*` env already stubbed).
- **Financial statements** (P&L / Balance Sheet / Cash Flow) and **bank reconciliation** —
  not computed; require journal-posting/statement logic.
- **2FA / password reset** — no MFA; self-service reset removed pending email integration
  (admins reset via People → Reset Password).
- **Duplicate seed files** — `packages/db/src/seed.ts` (canonical, run by `pnpm db:seed`,
  password `password123`) and `apps/web/prisma/seed.ts` (stale: obuasi-mining,
  `demo123456`) have diverged. Consolidate to one to avoid confusion.
- **Global search** — topbar field is disabled ("coming soon") until a search backend
  exists.

## Database migration note

The `OTHER_DEDUCTIONS_PAYABLE` value was added to the `PayrollGlLineType` enum (payroll
journal balance fix). Apply it to the database with `pnpm db:push` (or a migration) before
deploying — the Prisma client is already regenerated.

---

# Authorization core — production rollout

The RBAC permission system (real `can()` enforcement, `ALL/TEAM/OWN` scope, `ProjectMember`,
permission-aware guards + middleware) has landed **behind the `AUTHZ_ENFORCED` flag, which
defaults OFF**. With the flag off, the app behaves exactly as before (legacy admin/owner
checks apply). Turning it on is a deliberate, verified, reversible step.

Do these in order. Steps A–B are one-time; C–D are the go-live.

## A. Adopt Prisma migrations (one-time, replaces `db push`)

The repo now has `packages/db/prisma/migrations/`. `deploy.ps1` runs `migrate deploy`
instead of `db push`. The live DB was previously managed by `db push`, so it must be
baselined ONCE before `migrate deploy` will work:

```
ssh contabo
cd /var/www/crontract
# 1. Bring the live schema up to the current models (adds project_members, the
#    RolePermission.scope column, and the new enums — all ADDITIVE, no drops):
corepack pnpm --filter @crontract/db exec prisma db push
# 2. Mark the baseline migration as already-applied (it matches the schema now):
corepack pnpm --filter @crontract/db exec prisma migrate resolve --applied 00000000000000_baseline
# 3. Confirm a clean migration state:
corepack pnpm --filter @crontract/db migrate:status    # expect "Database schema is up to date!"
```

From here every `.\deploy.ps1` uses `migrate deploy` and never `db push`.

## B. Seed the catalogue + backfill grants (one-time, idempotent)

Grants every existing role its default permission set (so nobody loses access) and enrols
project owners as `LEAD` members. Safe to re-run.

```
ssh contabo
cd /var/www/crontract
corepack pnpm --filter @crontract/db exec tsx src/permissions/backfill.ts
# Prints: [backfill] workspaces=N grants=... projectMembers=...
# VERIFY before continuing: grants > 0, and projectMembers == number of projects.
```

Spot-check in the DB (or Prisma Studio) that the **Employee** role has NO
`finance:*` / `payroll:run:*` grants, and **Owner** has everything.

### Pre-enforcement scope caveats (optional hardening, not blockers)
Some entities have no owner/project column, so under enforcement their `TEAM/OWN` scope
falls back to workspace-wide visibility: **Asset, Permit, SafetyTraining, Donor, Indicator,
Logframe**, and **Document** (no `projectId`). If tight per-record scoping matters for these
before go-live, add `createdBy` columns (or make those catalogue codes `ALL`-scope). Otherwise
they behave as "any holder of the view permission sees all rows" — acceptable for most orgs.

## C. Go live (flip enforcement on)

```
ssh contabo
cd /var/www/crontract
# set AUTHZ_ENFORCED="true" in /var/www/crontract/.env  (chmod 600, single source of truth)
pm2 restart crontract --update-env
```

Then verify, in order:
1. **Shared box untouched:** `for p in 80 8080 8081 8082 8083; do curl -s -o /dev/null -w "$p:%{http_code}\n" http://127.0.0.1:$p/; done` — all prior codes unchanged.
2. **Owner** logs in → full access to every module.
3. **Employee** logs in → cannot open `/payroll` or `/finance` (redirected to `/unauthorized`); can see own dashboard, tasks, own payslip.
4. **Matrix means something:** as Owner, toggle a permission for a role in Admin → Permissions, save; the change takes effect for that role within ~60s.

## D. Rollback (instant, no redeploy)

If anything misbehaves:
```
# set AUTHZ_ENFORCED="false" in /var/www/crontract/.env
pm2 restart crontract --update-env
```
Behaviour reverts to exactly today's (legacy admin/owner checks). The migrations and
backfilled grants are additive and can stay in place.

> Reminder (unchanged constraint): keep AUTHZ_ENFORCED off — and no real payroll/PII — until
> HTTPS is live on a real domain. This rollout closes the *authorization* gap; it does not
> change the plain-HTTP transport risk.
