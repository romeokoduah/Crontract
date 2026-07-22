# Crontract → Contabo VPS Deployment

**Date:** 2026-07-22
**Status:** Approved
**Target:** `http://169.58.42.182:8083`

## Context

Crontract had no deployment infrastructure of any kind — no Dockerfile, no compose
file, no host config, no deploy scripts. The only CI was `.github/workflows/ci.yml`.
This is therefore a build-from-scratch production deployment, not a host-to-host
migration.

The target Contabo VPS already serves five live sites. **Not breaking them is the
governing constraint of this work**, ranking above deployment speed or elegance.

### Box state at time of writing (audited, read-only)

- Ubuntu 24.04, 4 cores, 7.8 GB RAM (6.0 GB free), 96 GB disk (85 GB free), 4 GB swap
- Load 1.04 across 4 cores
- Node 22.23.1, npm 10.9.8, corepack 0.34.6. **pnpm not installed.**
- PostgreSQL 16.14 on 127.0.0.1:5432 — existing DBs `cleen`, `cleen_test`, `eclipse`
- Docker **not** installed
- `ufw` inactive; `iptables` INPUT policy ACCEPT — no host firewall

| Port | Owner |
|---|---|
| 22 | sshd |
| 53 | systemd-resolved |
| 80 | nginx (portfolio, groupeania default_server) |
| 443 | nginx (cleenglobal.org, eclipsemotors) |
| 3000 | PM2 `cleen` |
| 3001 | PM2 `eclipse-motors` |
| 3002 | PM2 `groupeania` |
| 5432 | PostgreSQL 16 |
| 8080 | nginx → cleen |
| 8081 | nginx → carlab |
| 8082 | nginx → groupeania |
| 9090 | Cockpit |

## Decisions

### Rejected: Docker (initially chosen, revised after audit)

The user initially selected a full Docker stack. The audit changed the
recommendation and the user accepted the revision. Reasons:

- Docker is not installed. Installing it rewrites the `iptables` FORWARD chain on a
  box with five live nginx-fronted sites — real disruption risk for no needed benefit.
- PostgreSQL 16 is already running and can host a scoped database.
- The box has one uniform pattern (nginx → PM2 → Next.js). Docker would mean
  maintaining two deployment styles permanently.

Docker buys isolation; here isolation costs more than it returns.

### Rejected: separate Postgres instance

Role-level scoping (`NOSUPERUSER NOCREATEDB NOCREATEROLE`, owning only its own
database) provides sufficient data isolation. A second engine adds RAM cost, a second
patch surface, and a second backup target for no meaningful gain.

### Scope reduction: no Redis, no S3/MinIO

- `REDIS_URL` is aspirational. `src/lib/rate-limit.ts` is an in-memory fixed-window
  limiter; no Redis client is in `package.json`. The env var documents a future
  horizontal-scaling path.
- `S3_*` vars appear **only** in `src/lib/env.ts`. Nothing reads them. No file storage
  is implemented.

Crontract therefore requires exactly **Next.js + Postgres**.

## Architecture

```
Internet :8083 → nginx vhost "crontract" → 127.0.0.1:3003 → PM2 "crontract"
                                                                  ↓
                                    127.0.0.1:5432 Postgres 16 → db "crontract"
```

| Piece | Value | Rationale |
|---|---|---|
| Public port | `8083` | next in the existing 8080/81/82 series |
| Internal port | `3003` | next in the existing 3000/01/02 series |
| App dir | `/var/www/crontract` | matches `/var/www/cleen` |
| nginx vhost | `/etc/nginx/sites-available/crontract` | new file |
| PM2 process | `crontract` | new process |
| DB / role | `crontract` / `crontract` | new |

Every element is new. **No existing file is edited and no service is restarted**,
except `nginx -s reload` (graceful) after `nginx -t` passes.

## Database

Role `crontract` with a generated 48-character hex password (hex, not base64, so no
`/`, `+` or `=` can break the `DATABASE_URL`): `NOSUPERUSER NOCREATEDB NOCREATEROLE`,
owning only the `crontract` database.

Password at `/root/crontract_db_password.txt` (chmod 600), matching the existing
`cleen_db_password.txt` convention.

### Cross-database isolation — measured, not assumed

The role **can open a connection** to `cleen` and `eclipse`. This is Postgres's
default `CONNECT` grant to `PUBLIC` and is true of every role on the cluster.

Verified by probe that it **cannot**:

| Probe against `cleen` | Result |
|---|---|
| List tables via `information_schema` | `0` rows visible |
| `SELECT` from a table | `ERROR: permission denied for table` |
| `CREATE TABLE` | `ERROR: permission denied for schema public` |

Data isolation is therefore intact. **`CONNECT` was deliberately not revoked**:
doing so requires `REVOKE ... FROM PUBLIC` on the live `cleen` database, which risks
breaking a running production site for no actual gain in data protection. Revisit
only if a role ever needs genuine multi-tenant hardening on this cluster.

## Environment

`/var/www/crontract/.env`, chmod 600:

```
NODE_ENV=production
DATABASE_URL=postgresql://crontract:<generated>@127.0.0.1:5432/crontract
NEXTAUTH_URL=http://169.58.42.182:8083
NEXTAUTH_SECRET=<openssl rand -base64 32>
```

`NEXTAUTH_SECRET` must be ≥32 chars — enforced in production by `src/lib/env.ts`.
`NEXTAUTH_URL` is the only line that changes when a domain is attached later.

## Required code change: scheme-aware security headers

`apps/web/next.config.mjs` unconditionally emitted two HTTPS-only headers. One of
them is a hard blocker for a plain-HTTP deployment:

**`Content-Security-Policy: ... upgrade-insecure-requests`** — this directive is
honoured *regardless of the scheme the page was served over*. On
`http://169.58.42.182:8083` the browser would rewrite same-origin requests for
`/_next/static/*` to `https://169.58.42.182:8083/...`, where nothing is listening for
TLS. The app would have rendered a **blank page**, presenting as a mysterious broken
deploy with no server-side error.

**`Strict-Transport-Security`** — ignored by browsers over plain HTTP, so harmless
today, but advertising a two-year TLS-only policy from a host with no TLS is
misleading and becomes a footgun the first time that host is reached over HTTPS.

Both are now gated behind an `isHttps` flag derived from the `NEXTAUTH_URL` scheme.
They switch themselves back on automatically when a domain is attached.

`headers()` is evaluated at **build** time, so changing `NEXTAUTH_URL` requires a
rebuild, not merely a restart. (Same class of gotcha as CLEEN's
`NEXT_PUBLIC_SERVER_URL`.)

NextAuth needed no equivalent change: it derives `useSecureCookies` from the
`NEXTAUTH_URL` scheme on its own, so an `http://` URL correctly yields non-secure
cookies.

## Deploy mechanism

`deploy.ps1` in the repo root, modeled on the CLEEN pattern:

1. `tar` the working tree, excluding `node_modules`, `.next`, `.git`
2. Ship over SSH to `/var/www/crontract`
3. `corepack pnpm install` (provisions pinned `pnpm@10.33.2` from `packageManager`)
4. `pnpm db:generate` → `pnpm db:push`
5. `pnpm build`
6. `pm2 restart crontract`

Re-runnable for every subsequent deploy.

### `.env.local` must never be shipped — incident

The first transfer excluded `node_modules`, `.next` and `.git` but **not**
`apps/web/.env.local`. Two consequences, both real:

1. **Next.js gives `.env.local` higher precedence than `.env`**, so the developer's
   local file silently overrode the production config. The app booted and served
   pages, but `NEXTAUTH_URL` resolved to `http://localhost:3000` — every sign-in and
   callback URL pointed at the developer's laptop. Caught by inspecting
   `/api/auth/providers`, not by any error: the deployment *looked* healthy.
2. It copied **live developer secrets** (Resend API key, Google/Microsoft OAuth
   secrets, S3 keys) onto a shared production box.

Fixed by `shred`-ing the file, restarting, and re-verifying `/api/auth/providers`.
`deploy.ps1` now excludes `.env`, `.env.local` and `.env.example`, with a comment
explaining why the exclusion must not be removed.

Lesson worth generalising: a deployment returning `200` proves the process is up,
not that it is correctly configured. Assert on configuration-derived output.

## Safety protocol

1. **Baseline** — `curl` all five existing sites, record status codes, before any change.
2. **Additive only** — new files, new process, new DB. No existing config edited.
3. **`nginx -t` before every reload.** On failure, delete the symlink and stop; nginx
   continues serving the old config untouched.
4. **Reload, never restart** — `nginx -s reload` preserves live connections.
5. **Re-verify** — repeat the five `curl`s, compare against baseline. Any regression
   triggers immediate rollback.
6. **No firewall changes.** Enabling `ufw` could lock out both the live sites and the
   deploying SSH session.
7. **Watch memory during build** — CLEEN needed an 8 GB heap on this box. 6 GB free +
   4 GB swap should suffice, but verify rather than assume.

## Rollback

```bash
pm2 delete crontract && pm2 save
rm /etc/nginx/sites-enabled/crontract
nginx -t && nginx -s reload
# optional: dropdb crontract && dropuser crontract
```

Restores the box to its exact pre-deployment state.

## Known limitations (deliberate, not oversights)

### `prisma db push` instead of migrations

`packages/db/prisma/` has **no migrations directory**. `db push` is safe against an
empty database, which is the case here. However, once real data exists, `db push`
against a changed schema **can silently drop columns and tables**. Adopting
`prisma migrate` is required before this holds production data, and is the natural
next piece of work.

### HTTP only

No TLS. Login passwords and session cookies cross the network in cleartext. Accepted
by the user on the basis that a domain and Let's Encrypt will be attached later.

**Constraint: no real employee payroll or PII data until HTTPS is live.** Seeded demo
data only.

### Seeded demo credentials

`pnpm db:seed` creates demo workspaces with the password `password123`. These are
publicly known weak credentials on a public HTTP URL. Acceptable for a demo box; must
be wiped before any real use.

## Outcome (verified 2026-07-22)

Live at **http://169.58.42.182:8083**.

| Check | Result |
|---|---|
| `pnpm install` | 16.7s, pnpm 10.33.2 from the `packageManager` pin |
| `prisma db push` | 68 tables created |
| `pnpm db:seed` | 15 users, 3 workspaces |
| `pnpm build` | exit 0, 169s, peak 2.97 GB used / 4.9 GB free, **swap never touched** |
| PM2 `crontract` | online, ready in 697ms, on 127.0.0.1:3003 |
| nginx `-t` | passed before reload; reload was graceful |
| End-to-end login | `admin@goldstar.io` → real session (Kwame Mensah, GoldStar Mining, Owner) |
| Wrong password | `401`, empty session |
| `upgrade-insecure-requests` | absent from CSP, as required |
| Reboot persistence | `pm2 save` + `pm2-root` systemd unit enabled |

### Co-hosted sites: no regression

| Port | Site | Before | After |
|---|---|---|---|
| :80 | portfolio / groupeania | 200 | 200 |
| :8080 | cleen | 200 | 200 |
| :8081 | carlab | 200 | 200 |
| :8082 | groupeania | 200 | 200 |
| :443 | cleenglobal.org | 200 | 200 |

PM2 restart counters were **identical** before and after (cleen=3,
eclipse-motors=20, groupeania=0), confirming nothing was bounced.

## HTTPS + custom domain (crontract.com) — completed 2026-07-22

The "attach a domain later" follow-up was executed the same day. **crontract.com is
now the canonical URL, served over HTTPS.** `http://169.58.42.182:8083` still works
but is legacy (login there now sets `__Secure-` cookies that a plain-HTTP origin
can't retain).

### What was done

1. **DNS confirmed** — `crontract.com` and `www` both A-record to `169.58.42.182`
   (Namecheap NS). A phantom AAAA (`fd47:…`, a private ULA) seen from the local
   Windows resolver was **not** in authoritative or public DNS, so it posed no
   Let's Encrypt IPv6-validation risk.
2. **Cert issued via `--webroot`**, deliberately not `--nginx`, to keep certbot away
   from the hand-written vhosts of the co-hosted sites (`cleenglobal`, `eclipsemotors`).
   Webroot `/var/www/certbot`; cert covers both names, expires 2026-10-20.
3. **Hand-written 3-block vhost** `/etc/nginx/sites-available/crontract-ssl`
   (symlinked in): `:443` apex → `127.0.0.1:3003`; `:443` www → 301 apex; `:80` →
   301 HTTPS apex, with `/.well-known/acme-challenge/` preserved for unattended
   renewal. Security headers are **not** duplicated in nginx — the Next app owns
   them.
4. **`NEXTAUTH_URL` → `https://crontract.com`, rebuilt.** Because `headers()` is
   build-time, this rebuild flipped `isHttps` true, so HSTS and
   `upgrade-insecure-requests` now emit correctly. NextAuth switched to secure
   cookies automatically.

### Verified

| Check | Result |
|---|---|
| `https://crontract.com/login` | 200 |
| `www` → apex | 301 |
| `http` → `https` | 301 |
| Cert | Let's Encrypt, CN=crontract.com, +www, 89 days |
| CSP `upgrade-insecure-requests` | now **present** (was correctly absent on HTTP) |
| HSTS | present (`max-age=63072000; includeSubDomains; preload`) |
| End-to-end login over HTTPS | real session, `__Secure-next-auth` cookie |
| Renewal | `authenticator = webroot`, `webroot_path = /var/www/certbot`, `certbot.timer` enabled |
| Co-hosted sites | all still 200, unchanged |

### Renewal note

A `--dry-run` hung for 5+ minutes against Let's Encrypt **staging** and had to be
killed by PID (not `pkill -f "certbot renew"`, which would kill the SSH session).
This was a slow staging server, not a config fault — the renewal config is valid and
the production cert is fine. Real renewals use the production ACME endpoint via the
already-proven webroot path.

## Out of scope (flagged, not addressed)

**Cockpit on :9090** is a publicly reachable root-login panel. Prior session memory
records that the root password was exposed in chat and never rotated. This is the
largest security exposure on the box, unrelated to Crontract, and warrants separate
attention.
