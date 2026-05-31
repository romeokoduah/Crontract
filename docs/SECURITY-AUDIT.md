# Crontract — Production-Readiness & Security Audit

_Audit started: 2026-05-31. Multi-tenant Next.js 14 SaaS, Prisma/Postgres, NextAuth (JWT). 81 API routes, ~39k LOC._

This document tracks the commercialization-readiness audit and remediation, sequenced as
**Wave 1 Security → Wave 2 Tests → Wave 3 Quality → Wave 4 Production polish.**

---

## Baseline (before remediation)

| Check | Result |
|---|---|
| Typecheck (web) | ✅ pass |
| Typecheck (`packages/db`) | ❌ fail — missing `@types/node` |
| Lint | ❌ 8 errors + 2 warnings |
| Unit tests | 22 passing — but in **1 file / 255** (payroll tax only) |
| `pnpm audit` | 18 vulns (6 high, 10 moderate, 2 low) |
| Tenant isolation | Mostly disciplined — every API route except the NextAuth handler scopes by `workspaceId` |
| Rate limiting | ❌ none anywhere |
| Security headers / CSP | ❌ none (`next.config.mjs` empty) |

---

## Wave 1 — Security hardening (DONE)

### 1. Dependency vulnerabilities
- Added `pnpm.overrides` for the patchable transitive deps: `glob` (≥10.5.0), `postcss` (≥8.5.10),
  `brace-expansion` (≥1.1.12 / ≥2.0.2), `uuid` (≥11.1.1). **18 → 15 vulns.**
- **Remaining 15 are Next.js 14.x advisories with no 14.x patch** — they are only fixed in Next 15.x
  (DoS, SSRF, cache-poisoning, middleware bypass). Per decision, the v14→v15 major upgrade is
  **deferred** to a dedicated migration. These are **mitigated** below and MUST be tracked as the top
  follow-up. See "Deferred / known-residual risk".

### 2. Security headers + CSP (`apps/web/next.config.mjs`)
Added a global `headers()` policy: `Content-Security-Policy` (default-src 'self', frame-ancestors
'none', object-src 'none', upgrade-insecure-requests; `unsafe-eval` gated to dev only),
`Strict-Transport-Security` (2y, preload), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo/topics off),
`X-DNS-Prefetch-Control: off`. Disabled `X-Powered-By`.
- _Follow-up:_ move next-themes off its inline script so the CSP can drop `script-src 'unsafe-inline'`
  in favour of nonces.

### 3. Rate limiting (`apps/web/src/lib/rate-limit.ts` — new)
In-memory fixed-window limiter (`rateLimit`, `enforceRateLimit`, `getClientIp`), unit-tested.
Applied to the abuse-prone flows:
- **Login** (`lib/auth.ts authorize`) — 10 / 5 min per IP+email (credential-stuffing / brute force).
- **Signup** — 5 / 10 min per IP.
- **Accept-invite** — 10 / 10 min per IP.
- **Change-password** — 5 / 5 min per IP+user.
- _Caveat (documented in code):_ in-memory state is per-instance — back with Redis (`REDIS_URL` is
  already wired) for multi-instance/serverless deployments. Same `rateLimit()` signature; swap the store.

### 4. Authorization / IDOR sweep (all 81 routes)
Full read of every `route.ts`. Tenant isolation via `workspaceId` was already correct across the board.
Findings fixed:
- **HIGH (defense-in-depth):** 5 `/api/admin/*` handlers (`members`, `workspace`, `audit`, `roles`,
  `roles/[id]/permissions`) enforced admin only via edge middleware. Given Next.js's middleware-bypass
  CVE history, relying on a single edge gate is fragile — added in-handler `requireAdminRole()` to each.
- **MEDIUM (real IDOR):** `documents/[id]` PATCH wrote a caller-supplied `folderId` without verifying the
  folder belongs to the caller's workspace — cross-tenant reference. Now validated against `workspaceId`.

### 5. Lint errors (pulled forward — needed for a green build)
Fixed all 8 blocking lint errors (unused imports/vars, unescaped JSX entities, replaced two `as any`
casts on response bodies with type-safe `Uint8Array`).

### Wave 1 verification
`next lint` (0 errors), `tsc --noEmit` (clean), `next build` (success), `vitest` (30 passing).

---

## Wave 2 — Test safety net (DONE)

Coverage grew from **22 tests in 1 file → 52 tests in 4 files**, targeting the highest-risk pure logic:
- `lib/payroll/journal-poster.test.ts` (new, 12) — **double-entry GL correctness**: asserts the journal
  balances (DR == CR), each line maps to the right account with the right amount, multi-payslip
  aggregation, currency rounding, the missing-GL-mapping and empty-run guards, reversal symmetry, and
  loan-balance math (post/reverse/paid-off/ignore-unknown).
- `lib/authorization.test.ts` (new, 10) — the auth gates: `isAdmin` (incl. case-sensitivity so a stray
  `"owner"`/`"Admin"` can't escalate), `requireAuth` (401/403 ordering), `requireAdminRole` (checks
  auth+workspace before role).
- `lib/rate-limit.test.ts` (new, 8) — limiter window/reset/isolation and the 429 response shape.
- `lib/payroll/tax-ghana.test.ts` (existing, 22) — PAYE brackets, reliefs, payslip computation.

_Follow-up:_ add route-level integration tests against an ephemeral Postgres (the route handlers and
`run-builder.ts` import the Prisma singleton directly, so they need a test DB or a module mock rather
than a stub). The pure money/security invariants are now locked.

## Wave 3 — Code quality (DONE)
- **Unified password policy** (`lib/password-policy.ts`, new): one shared zod schema (≥10 chars +
  upper/lower/digit/symbol) now used by signup, accept-invite, and change-password — previously each
  endpoint had its own divergent rule (signup was just `min 8`). Demo seed accounts are unaffected
  (they're hashed directly, not run through these schemas).
- **Fixed `packages/db` typecheck**: added `@types/node`; `pnpm -r typecheck` is now fully green.
- **Fixed both `react-hooks/exhaustive-deps` warnings**: wrapped the `load()` fetchers in `useCallback`
  in `tax-settings-client` and `pay-setup-client`. `next lint` now reports **0 warnings, 0 errors**.

## Wave 4 — Production polish (DONE)
- **Boot-time env validation** (`lib/env.ts` + `src/instrumentation.ts`): a zod-validated env schema runs
  once at server startup so a misconfigured deployment fails fast with a readable error. Enforces a
  32+ char `NEXTAUTH_SECRET` in production; `SKIP_ENV_VALIDATION=1` escape hatch for build steps.
  Unit-tested (7 cases).
- **Health probe** (`/api/health`): unauthenticated (allow-listed in middleware), runs `SELECT 1`,
  returns 200/`db: up` or 503/`db: down`, `no-store`. For load balancers / uptime monitors.
- **CI pipeline** (`.github/workflows/ci.yml`): on push to main + every PR — install (frozen lockfile),
  generate Prisma clients, lint, `pnpm -r typecheck`, test, build (with placeholder env). Plus a
  non-blocking high-severity dependency-audit job. Pinned `packageManager` to `pnpm@10.33.2`.

## Final scorecard

| Check | Before | After |
|---|---|---|
| Lint | 8 errors + 2 warnings | **0 / 0** |
| Typecheck (workspace) | `packages/db` broken | **fully green** |
| Tests | 22 in 1 file | **59 in 5 files** (GL balance, authz, rate-limit, env, tax) |
| Build | ❌ (lint-blocked) | **✅** |
| Dependency vulns | 18 (6 high) | **15** (residual = unpatchable Next 14.x) |
| Rate limiting | none | login/signup/invite/change-password |
| Security headers / CSP | none | full set + CSP |
| Password policy | 3 divergent rules | 1 shared strong policy |
| Boot env validation | none | zod-validated, fail-fast |
| Health endpoint | none | `/api/health` |
| CI | none | lint + typecheck + test + build + audit |

## Recommended follow-ups (not in this engagement's scope)
1. **Next.js 14 → 15 upgrade** — closes the 15 residual high/moderate advisories (DoS, SSRF,
   middleware bypass). Top priority; do it behind the new test net. _(Deferred per decision.)_
2. **Route-level integration tests** against an ephemeral Postgres — covers the DB-coupled handlers and
   `run-builder.ts` that stubs can't reach.
3. **Consolidate the two `schema.prisma` files** (`apps/web/prisma` and `packages/db/prisma`) to a single
   source of truth to prevent schema drift.
4. **Back the rate limiter with Redis** (`REDIS_URL` already wired) for multi-instance/serverless deploys.
5. **Nonce-based CSP** — drop `script-src 'unsafe-inline'` once next-themes' inline script is replaced.

## Deferred / known-residual risk
- **Next.js 14 → 15 upgrade.** The 15 remaining advisories (incl. high-severity DoS/SSRF and the
  middleware/proxy bypass) are only patched in Next 15.x. The defense-in-depth admin checks and CSP
  reduce blast radius, but this upgrade is the **single most important** production follow-up and should
  be scheduled once the Wave 2 test net exists to catch regressions.
