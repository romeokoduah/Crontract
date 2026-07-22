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
