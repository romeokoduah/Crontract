# Authorization Core — Design Spec

**Date:** 2026-07-22
**Status:** Approved for planning
**Sub-project:** 1 of 4 (Authorization core → Project management → Workflow engine → System conformance sweep)

---

## Problem

Crontract ships a permission model that does not enforce anything.

- `Permission`, `RolePermission`, and an admin **permission matrix UI** exist, but **no server code reads them**. `hasPermission` has zero call sites in application code.
- Every authorization guard reduces to a string comparison on the role *name*:
  `ADMIN_ROLES = ["Owner", "Administrator"]` in `apps/web/src/lib/authorization.ts`.
- Consequences, all live in production today:
  - Editing the permission matrix changes nothing — access is unaffected. (Trust-destroying in a governance product.)
  - A custom role gets near-zero write access anywhere, because it is not literally named `Administrator`.
  - Renaming a role to `Administrator` grants full admin. Authorization by string equality on a user-editable field.
- **Page-level access control barely exists.** `middleware.ts` gates only `/admin` and `/api/admin`. The dashboard layout checks only "is there a session." Therefore **any authenticated member can read `/payroll`, `/finance`, `/people`, `/crm`** — every salary, SSNIT number, and payslip. Hiding a nav link is not access control.
- The catalogue is also **incomplete**: only **8 permissions** are defined (all payroll, in `packages/db/src/permissions-seed.ts`). `PROGRESS.md` claims 112 — this is inaccurate. ~23 modules have no permission codes at all.

The taxonomy that exists is sound: `module:entity:action`, and `payroll:payslip:view_own` already proves the system needs **scope**, not just verbs. The job is to complete the catalogue and build the enforcement layer that makes it binding.

## Goals

1. Make role permissions actually govern access at the API boundary.
2. Introduce a **scope** dimension (`ALL` / `TEAM` / `OWN`) so rules like "a PM can move any card on their project, but not on another team's" are expressible.
3. Close the payroll/PII exposure: non-privileged members cannot read financial/HR modules.
4. Make the admin permission matrix meaningful — saving it changes behaviour within ~60s.
5. Adopt Prisma migrations, ending the destructive `db push` deploy path.
6. Roll out on the **live Contabo box** without locking existing users out or losing data.

## Non-goals

- The six Kanban/board bugs themselves (fixed in sub-project 2, Project Management). This spec builds the auth layer they depend on and tests the auth-side behaviour ("a member can update a TEAM task").
- A general workflow/approval state-machine engine (sub-project 3).
- Auditing all 23 modules for dead buttons / broken flows (sub-project 4).
- A policy engine (CASL/Casbin). Explicitly rejected as over-engineered for now.
- Record-level / custom-field conditional rules beyond the three scopes.

---

## Design decisions (locked during brainstorming)

| Decision | Choice | Why |
|---|---|---|
| Auth model | **RBAC + scope dimension** | Expresses every current rule (incl. `view_own`) without a code explosion; standard in Odoo/NetSuite-class systems. |
| TEAM scope backing | **Add `ProjectMember` now** | TEAM = "a project I'm a member of" needs the table; three board bugs trace to its absence. |
| Rollout | **Migrations + backfill + enforce** | Safest on a live DB; also closes the migrations gap flagged in deploy notes. |
| Permissions at runtime | **Server-side, role-cached ~60s** — not in JWT | JWT would be large and stale; cache keeps edits fresh within a minute. |
| Enforcement default | **Fail-closed**, behind `AUTHZ_ENFORCED` flag | Land code safely, flip on deliberately, instant rollback. |

---

## Architecture

### The decision engine

One authoritative function:

```ts
can(user, "projects:task:update", resource?): boolean
```

Resolution:
1. Load the user's role grants for the given permission code (cached per role, see below).
2. Take the **widest scope** granted (`ALL` > `TEAM` > `OWN`). No grant → deny.
3. Check the resource against the scope:
   - `ALL` → allowed anywhere in the workspace.
   - `TEAM` → allowed if the user is a `ProjectMember` of the resource's project.
   - `OWN` → allowed if the user owns / created / is assigned the resource.
4. When no `resource` is passed (e.g. a list or create endpoint), `ALL`/`TEAM`/`OWN` collapse to "does the user hold this code at any scope"; row-level filtering is applied in the query (see Scope filtering).

Fail-closed: unknown code or missing grant → `false`.

### Where permissions live at runtime

- **JWT keeps** `role` + `workspaceId` (unchanged from today).
- The engine loads that role's `(code, scope)` grants **server-side**, cached in an in-memory `Map` keyed by `roleId`, TTL ~60s, **invalidated immediately when the permission matrix saves** (the matrix PATCH clears the cache entry).
- Net effect: a permission change takes effect within a minute, not on next login; no bloated token.
- Caveat: the cache is per-process. PM2 runs a single `crontract` process today, so one cache. If clustered later, switch invalidation to a short Redis pub/sub or drop TTL — noted, not needed now.

### Three enforcement layers (defence in depth)

1. **Middleware** — coarse per-prefix allow/deny. Fast-fails obvious cases (e.g. `/payroll` requires holding any `payroll:*:view`). Cannot do resource-level checks (no DB in edge middleware) — coarse only.
2. **API route guards** — the real boundary. `requirePermission(code, resource?)` at the top of each handler. **Authoritative.**
3. **UI** — `can()` surfaced to the client to hide buttons/nav. Convenience only, never trusted.

---

## Data model

Three additions, delivered as additive migrations (zero risk to existing rows):

```prisma
enum PermissionScope { ALL  TEAM  OWN }

model RolePermission {
  // existing: id, roleId, permissionId, @@unique([roleId, permissionId])
  scope PermissionScope @default(ALL)   // NEW
}

enum ProjectRole { LEAD  MEMBER  VIEWER }

model ProjectMember {                    // NEW
  id        String      @id @default(uuid()) @db.Uuid
  projectId String      @map("project_id") @db.Uuid
  userId    String      @map("user_id") @db.Uuid
  role      ProjectRole @default(MEMBER)
  createdAt DateTime    @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@map("project_members")
}
```

`Project.ownerId` is retained. The owner is auto-enrolled as a `LEAD` `ProjectMember` on project create and during backfill. `Project` and `User` gain the corresponding `members ProjectMember[]` back-relations.

### The permission catalogue

A typed registry at `packages/db/src/permissions/catalogue.ts`, replacing the payroll-only `permissions-seed.ts`. One entry per `module:entity:action`:

```ts
type PermissionDef = {
  code: string          // "projects:task:update"
  module: string        // "projects"
  entity: string
  action: string
  description: string
  scopes: PermissionScope[]  // which scopes are MEANINGFUL for this code
}
```

Target ~90–110 codes across all 23 modules (view / create / update / delete / approve as each needs). Examples of scope declarations:
- `payroll:run:*` → `[ALL]` (no team/own concept).
- `payroll:payslip:view_own` → `[OWN]`.
- `projects:task:update` → `[ALL, TEAM, OWN]`.

The seed upserts these idempotently (safe to re-run). Existing payroll codes are preserved by code.

### Default role → grant mapping (backfill source of truth)

Derived from **today's** behaviour so no one loses access:

| Role | Grants |
|---|---|
| Owner / Administrator | every code @ `ALL` |
| Manager *(new default role, seeded)* | `view` @ `ALL`; `create` / `update` @ `TEAM` on operational modules (projects, tasks, procurement, assets, hse, crm, meetings, documents) |
| Member | `view` @ `TEAM`; `update` @ `OWN`; `payroll:payslip:view_own` |
| Viewer | `view` @ `TEAM`/`OWN` only |

Financial/HR modules (`payroll`, `finance`, `people` salary fields) are **not** granted to Member/Viewer at any scope beyond self-service — this is what closes the current exposure.

---

## Scope filtering (list endpoints)

Guards protect single-resource mutations; **list endpoints must also filter rows** to the caller's scope, else `TEAM`/`OWN` leak via the list. Pattern: a helper `scopeWhere(user, code)` returns a Prisma `where` fragment:
- `ALL` → `{}` (workspace filter still applies).
- `TEAM` → `{ project: { members: { some: { userId } } } }` (or module equivalent).
- `OWN` → `{ OR: [{ createdBy: userId }, { assigneeId: userId }, { ownerId: userId }] }` (fields per entity).

Every module list route composes this into its existing workspace-scoped query.

---

## Rollout sequence (safety-critical, ordered)

Each step is independently verifiable; nothing is enforced until step 6.

1. **Baseline migrations.** `prisma migrate diff` the current live schema into an initial migration, marked already-applied on Contabo (`migrate resolve --applied`). `deploy.ps1` switches from `db push` to `migrate deploy`. *Closes the silent-column-drop risk in the deploy notes.*
2. **Additive migration.** Add `ProjectMember`, `RolePermission.scope`, both enums. Additive only.
3. **Seed the catalogue.** Upsert all codes. No enforcement yet.
4. **Backfill grants** (idempotent script): map every existing role to the default grants; auto-enrol project owners as `LEAD`. Run, then **verify grant + membership counts** before proceeding.
5. **Land enforcement code.** Replace `isAdmin`-based guards with `requirePermission` across the 82 API routes + middleware + UI, behind `AUTHZ_ENFORCED` defaulting **off** in the same commit. Smoke-test with the flag off (behaviour identical to today).
6. **Turn it on.** Set `AUTHZ_ENFORCED=true` on Contabo. Re-run the curl baseline for the other 5 sites on the shared box (must be untouched). Spot-check each module as Owner and as a Member.

**Rollback:** `AUTHZ_ENFORCED=false` → instant revert to current behaviour, no redeploy.

---

## Testing strategy

- **Unit — `can()` truth table.** Every scope × (owner / team-member / stranger) × (has / lacks grant). The heart of the system; exhaustive.
- **Catalogue integrity.** (a) Every permission code referenced by a route guard exists in the catalogue (prevents typo-deny). (b) Every mutating route has a guard (prevents unguarded endpoints). Both enforced as tests that scan the route tree.
- **Scope filtering.** List endpoint returns only in-scope rows for TEAM / OWN callers.
- **Backfill idempotency.** Run twice → identical grant and membership counts.
- **Cache invalidation.** Matrix save → next `can()` reflects the change without waiting for TTL.
- **Regression (auth-side of the board).** A Member who is a `ProjectMember` can PATCH a TEAM task; a non-member gets 403. (The UI board bugs themselves are sub-project 2.)
- **Manual.** The step-6 checklist, plus the shared-box curl baseline.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Backfill under-grants → users locked out | Defaults derived from current behaviour; verify counts at step 4; `AUTHZ_ENFORCED` off until verified; instant flag rollback. |
| `migrate resolve` mis-baselined → future migration fails | Baseline on a DB snapshot first; confirm `migrate status` clean before deploying. |
| Shared Contabo box collateral damage | No nginx/port changes in this work; re-run curl baseline for all 6 sites at step 6; `nginx -t` unaffected (no server-config edits). |
| Per-process cache stale after matrix edit on a future cluster | Documented; single PM2 process today; switch to Redis/short-TTL when clustered. |
| Middleware can't do resource checks | By design — middleware is coarse; API guards are authoritative. |
| Catalogue drift from routes | Integrity tests fail the build on missing/typo codes. |

---

## Definition of done

- `can()` + `requirePermission()` implemented, unit-tested to the truth table.
- Catalogue seeded for all 23 modules; integrity tests green.
- `ProjectMember`, `RolePermission.scope` migrated; backfill run and count-verified.
- Every mutating handler across the 82 API route files guarded; list routes scope-filtered.
- Middleware gates each module prefix by view permission.
- Permission matrix save invalidates cache and changes behaviour.
- `deploy.ps1` uses `migrate deploy`; no `db push`.
- Non-member cannot read `/payroll` (verified manually + test).
- Rollback verified: `AUTHZ_ENFORCED=false` restores current behaviour.
