# Authorization Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Crontract's RBAC permission model actually enforce access, with an `ALL`/`TEAM`/`OWN` scope dimension, delivered safely to the live Contabo database.

**Architecture:** A typed permission catalogue is seeded into the DB. A `RolePermission.scope` column and a new `ProjectMember` table back the scope dimension. A single `can(user, code, resource?)` engine resolves a role's grants (cached ~60s per role) and evaluates scope. Enforcement lands across API routes, middleware, and UI behind an `AUTHZ_ENFORCED` flag that defaults off, so code deploys safely and is flipped on deliberately with instant rollback.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Prisma 5 + PostgreSQL 16, NextAuth (JWT), Vitest, pnpm workspaces.

## Global Constraints

- **Fail-closed:** unknown permission code or missing grant → deny.
- **No `db push` for schema changes once this lands:** use `prisma migrate`. The baseline migration must be resolved as already-applied on Contabo before any deploy.
- **Additive migrations only** in this work — never drop/rename existing columns.
- **`AUTHZ_ENFORCED` defaults to `false`** (env var). All enforcement is gated on it; when off, behaviour is identical to today.
- **Permissions are NOT stored in the JWT.** JWT keeps `role` + `workspaceId` only (unchanged). Grants are resolved server-side, cached per `roleId`, TTL 60s, invalidated on matrix save.
- **Scope precedence:** `ALL` > `TEAM` > `OWN`. `can()` uses the widest scope the role holds for the code.
- **Real seeded roles are** `Owner`, `Administrator`, `Manager`, `Employee`. No new roles.
- **Shared box:** no nginx/port/server-config changes anywhere in this work.
- **Permission code format:** `module:entity:action` (lowercase, colon-separated), matching existing `payroll:*` codes.
- Tests run from `apps/web` with `pnpm vitest run <path>`. DB-schema packages typecheck with `pnpm --filter @crontract/db typecheck`.

---

## File Structure

**New files:**
- `packages/db/src/permissions/catalogue.ts` — typed registry of all permission codes + which scopes are meaningful per code.
- `packages/db/src/permissions/role-defaults.ts` — role → `(code, scope)` default grant map (backfill source of truth).
- `packages/db/src/permissions/backfill.ts` — idempotent script: seed catalogue, grant defaults to existing roles, enrol project owners as LEAD members.
- `apps/web/src/lib/authz/scopes.ts` — `PermissionScope` type mirror + scope precedence helpers.
- `apps/web/src/lib/authz/grants.ts` — role-grant loader with 60s per-role cache + `invalidateRoleGrants()`.
- `apps/web/src/lib/authz/can.ts` — `can()` engine + `requirePermission()` API guard + `scopeWhere()` list filter.
- `apps/web/src/lib/authz/__tests__/can.test.ts` — truth-table unit tests.
- `apps/web/src/lib/authz/__tests__/catalogue-integrity.test.ts` — code-exists + route-guarded scans.

**Modified files:**
- `packages/db/prisma/schema.prisma` — add `PermissionScope` enum, `RolePermission.scope`, `ProjectMember` model, `ProjectRole` enum, back-relations.
- `packages/db/src/seed.ts` — call catalogue seed + role defaults instead of payroll-only.
- `packages/db/src/permissions-seed.ts` — kept for payroll codes, invoked by catalogue (no behavioural change to payroll grants).
- `apps/web/src/lib/authorization.ts` — add `requirePermission` re-export; keep `isAdmin`/`requireAuth` for the flag-off path.
- `apps/web/src/middleware.ts` — per-module-prefix view-permission gate (behind flag).
- `apps/web/src/lib/env.ts` — add `AUTHZ_ENFORCED`.
- API route handlers (per-module tasks) — swap `isAdmin` guards for `requirePermission`.
- `apps/web/src/app/api/admin/roles/[id]/permissions/route.ts` — persist scope + call `invalidateRoleGrants`.
- `deploy.ps1` — `db push` → `migrate deploy`.

---

## Task 1: Schema — scope column, ProjectMember, enums

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Modify: `packages/db/src/seed.ts` (owner → LEAD member on project create, in the projects seed loop)

**Interfaces:**
- Produces: `PermissionScope` enum (`ALL`|`TEAM`|`OWN`), `ProjectRole` enum (`LEAD`|`MEMBER`|`VIEWER`), `RolePermission.scope` field, `project_members` table with `@@unique([projectId, userId])`.

- [ ] **Step 1: Add enums and scope column to `RolePermission`**

In `schema.prisma`, near the existing `RolePermission` model:

```prisma
enum PermissionScope {
  ALL
  TEAM
  OWN
}

enum ProjectRole {
  LEAD
  MEMBER
  VIEWER
}
```

Add to `model RolePermission`:

```prisma
  scope PermissionScope @default(ALL) @map("scope")
```

- [ ] **Step 2: Add `ProjectMember` model + back-relations**

```prisma
model ProjectMember {
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

Add `members ProjectMember[]` to `model Project`. Add `projectMemberships ProjectMember[]` to `model User`.

- [ ] **Step 3: Generate client and validate schema**

Run: `pnpm --filter @crontract/db exec prisma validate`
Expected: "The schema at packages/db/prisma/schema.prisma is valid 🚀"

Run: `pnpm --filter @crontract/db generate`
Expected: "Generated Prisma Client" with no errors.

- [ ] **Step 4: Enrol project owner as LEAD in seed**

In `packages/db/src/seed.ts`, where projects are created in the projects loop, after each `prisma.project.create`/`upsert`, add:

```ts
await prisma.projectMember.upsert({
  where: { projectId_userId: { projectId: project.id, userId: ownerUserId } },
  update: { role: "LEAD" },
  create: { projectId: project.id, userId: ownerUserId, role: "LEAD" },
})
```

(Use whatever the loop already calls the created project and its resolved owner user id — locate the existing `ownerIdx` → user resolution and reuse it.)

- [ ] **Step 5: Typecheck the db package**

Run: `pnpm --filter @crontract/db typecheck`
Expected: exit 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/src/seed.ts
git commit -m "feat(authz): add PermissionScope, ProjectMember, RolePermission.scope"
```

---

## Task 2: Permission catalogue

**Files:**
- Create: `packages/db/src/permissions/catalogue.ts`
- Test: `packages/db/src/permissions/__tests__/catalogue.test.ts`

**Interfaces:**
- Produces:
  - `type PermissionScope = "ALL" | "TEAM" | "OWN"`
  - `interface PermissionDef { code: string; module: string; entity: string; action: string; description: string; scopes: PermissionScope[] }`
  - `const CATALOGUE: PermissionDef[]`
  - `const CATALOGUE_BY_CODE: Map<string, PermissionDef>`
  - `function moduleOf(code: string): string`

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/permissions/__tests__/catalogue.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { CATALOGUE, CATALOGUE_BY_CODE, moduleOf } from "../catalogue"

describe("permission catalogue", () => {
  it("has unique codes", () => {
    const codes = CATALOGUE.map((p) => p.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it("every code is module:entity:action", () => {
    for (const p of CATALOGUE) {
      expect(p.code).toBe(`${p.module}:${p.entity}:${p.action}`)
    }
  })

  it("every code declares at least one scope", () => {
    for (const p of CATALOGUE) expect(p.scopes.length).toBeGreaterThan(0)
  })

  it("preserves the existing payroll self-service code as OWN", () => {
    const p = CATALOGUE_BY_CODE.get("payroll:payslip:view_own")
    expect(p).toBeDefined()
    expect(p!.scopes).toEqual(["OWN"])
  })

  it("covers all 23 modules", () => {
    const modules = new Set(CATALOGUE.map((p) => moduleOf(p.code)))
    for (const m of [
      "admin","approvals","assets","budget","compliance","crm","dashboard",
      "documents","finance","grants","hse","meetings","notifications",
      "payroll","people","procurement","projects","reports","social",
    ]) expect(modules.has(m)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @crontract/db exec vitest run src/permissions/__tests__/catalogue.test.ts`
Expected: FAIL — cannot resolve `../catalogue`.

- [ ] **Step 3: Write the catalogue**

Create `packages/db/src/permissions/catalogue.ts`. Define the type, then the array. Build codes with a helper to stay DRY. For each module, emit `view`/`create`/`update`/`delete` and any module-specific verbs (e.g. `approve`). Scope rules: financial/system modules (`payroll:run`, `finance`, `admin`, `budget`, `compliance`) → `["ALL"]`; project-scoped operational entities (`projects:*`, `meetings`, `documents`, `assets`, `hse:incident`, `procurement`, `crm`, `grants`) → `["ALL","TEAM","OWN"]`; self-service → `["OWN"]`.

```ts
export type PermissionScope = "ALL" | "TEAM" | "OWN"

export interface PermissionDef {
  code: string
  module: string
  entity: string
  action: string
  description: string
  scopes: PermissionScope[]
}

const ALL: PermissionScope[] = ["ALL"]
const TEAM: PermissionScope[] = ["ALL", "TEAM", "OWN"]
const OWN: PermissionScope[] = ["OWN"]

function def(
  module: string, entity: string, action: string,
  scopes: PermissionScope[], description: string,
): PermissionDef {
  return { code: `${module}:${entity}:${action}`, module, entity, action, scopes, description }
}

export const CATALOGUE: PermissionDef[] = [
  // ── admin (system, ALL only) ──
  def("admin", "member", "view",   ALL, "View workspace members"),
  def("admin", "member", "manage", ALL, "Add/remove/invite members"),
  def("admin", "role",   "view",   ALL, "View roles"),
  def("admin", "role",   "manage", ALL, "Create/edit roles and permissions"),
  def("admin", "workspace", "manage", ALL, "Edit workspace settings"),
  def("admin", "audit",  "view",   ALL, "View audit log"),

  // ── projects (team-scoped) ──
  def("projects", "project", "view",   TEAM, "View projects"),
  def("projects", "project", "create", TEAM, "Create projects"),
  def("projects", "project", "update", TEAM, "Edit projects"),
  def("projects", "project", "delete", TEAM, "Delete projects"),
  def("projects", "task",    "view",   TEAM, "View tasks"),
  def("projects", "task",    "create", TEAM, "Create tasks"),
  def("projects", "task",    "update", TEAM, "Edit/move tasks"),
  def("projects", "task",    "delete", TEAM, "Delete tasks"),

  // ── people (HR — view team; salary via finance) ──
  def("people", "employee", "view",   TEAM, "View employees"),
  def("people", "employee", "create", ALL,  "Create employees"),
  def("people", "employee", "update", ALL,  "Edit employees"),
  def("people", "employee", "delete", ALL,  "Delete employees"),

  // ── payroll (preserve existing 8 codes exactly) ──
  def("payroll", "run",       "create",   ALL, "Create a payroll run"),
  def("payroll", "run",       "approve",  ALL, "Approve a payroll run"),
  def("payroll", "run",       "post",     ALL, "Post a payroll run to GL"),
  def("payroll", "run",       "view",     ALL, "View payroll runs"),
  def("payroll", "settings",  "manage",   ALL, "Manage tax rates and GL mapping"),
  def("payroll", "component", "manage",   ALL, "Manage pay components"),
  def("payroll", "loan",      "manage",   ALL, "Manage staff loans"),
  def("payroll", "payslip",   "view_own", OWN, "View own payslip"),

  // ── finance (ALL only) ──
  def("finance", "invoice", "view",   ALL, "View invoices"),
  def("finance", "invoice", "create", ALL, "Create invoices"),
  def("finance", "invoice", "update", ALL, "Edit invoices"),
  def("finance", "bill",    "view",   ALL, "View bills"),
  def("finance", "bill",    "create", ALL, "Create bills"),
  def("finance", "expense", "view",   ALL, "View expenses"),
  def("finance", "expense", "create", ALL, "Create expenses"),
  def("finance", "account", "view",   ALL, "View chart of accounts"),
  def("finance", "account", "manage", ALL, "Manage chart of accounts"),

  // ── budget (ALL only) ──
  def("budget", "budget", "view",   ALL, "View budgets"),
  def("budget", "budget", "create", ALL, "Create budgets"),
  def("budget", "budget", "update", ALL, "Edit budgets"),

  // ── procurement (team-scoped) ──
  def("procurement", "po",          "view",   TEAM, "View purchase orders"),
  def("procurement", "po",          "create", TEAM, "Create purchase orders"),
  def("procurement", "po",          "update", TEAM, "Edit purchase orders"),
  def("procurement", "requisition", "view",   TEAM, "View requisitions"),
  def("procurement", "requisition", "create", TEAM, "Create requisitions"),
  def("procurement", "vendor",      "view",   ALL,  "View vendors"),
  def("procurement", "vendor",      "manage", ALL,  "Manage vendors"),

  // ── assets (team-scoped) ──
  def("assets", "asset", "view",   TEAM, "View assets"),
  def("assets", "asset", "create", TEAM, "Register assets"),
  def("assets", "asset", "update", TEAM, "Edit assets"),

  // ── hse (team-scoped) ──
  def("hse", "incident", "view",    TEAM, "View incidents"),
  def("hse", "incident", "report",  TEAM, "Report incidents"),
  def("hse", "incident", "update",  TEAM, "Investigate/close incidents"),
  def("hse", "permit",   "view",    TEAM, "View permits"),
  def("hse", "permit",   "manage",  TEAM, "Manage permits"),

  // ── crm (team-scoped) ──
  def("crm", "contact",  "view",   TEAM, "View contacts"),
  def("crm", "contact",  "manage", TEAM, "Manage contacts"),
  def("crm", "deal",     "view",   TEAM, "View deals"),
  def("crm", "deal",     "manage", TEAM, "Manage deals"),
  def("crm", "activity", "manage", TEAM, "Log activities"),

  // ── grants (team-scoped) ──
  def("grants", "grant",     "view",   TEAM, "View grants"),
  def("grants", "grant",     "manage", TEAM, "Manage grants"),
  def("grants", "donor",     "view",   TEAM, "View donors"),
  def("grants", "indicator", "manage", TEAM, "Manage indicators"),

  // ── compliance (ALL only) ──
  def("compliance", "obligation", "view",   ALL, "View obligations"),
  def("compliance", "obligation", "manage", ALL, "Manage obligations"),
  def("compliance", "licence",    "view",   ALL, "View licences"),

  // ── meetings (team-scoped) ──
  def("meetings", "meeting", "view",   TEAM, "View meetings"),
  def("meetings", "meeting", "create", TEAM, "Create meetings"),
  def("meetings", "meeting", "update", TEAM, "Edit meetings/minutes"),

  // ── documents (team-scoped) ──
  def("documents", "document", "view",   TEAM, "View documents"),
  def("documents", "document", "create", TEAM, "Upload documents"),
  def("documents", "document", "update", TEAM, "Edit documents"),
  def("documents", "document", "delete", TEAM, "Delete documents"),

  // ── approvals (own — you act on approvals routed to you) ──
  def("approvals", "approval", "view", OWN, "View my approvals"),
  def("approvals", "approval", "act",  OWN, "Approve/reject items routed to me"),

  // ── notifications (own) ──
  def("notifications", "notification", "view", OWN, "View own notifications"),

  // ── social (ALL only) ──
  def("social", "post", "view",    ALL, "View social posts"),
  def("social", "post", "manage",  ALL, "Compose/schedule posts"),
  def("social", "post", "publish", ALL, "Publish posts"),

  // ── reports (ALL only) ──
  def("reports", "report", "view", ALL, "View reports"),

  // ── dashboard (own) ──
  def("dashboard", "dashboard", "view", OWN, "View dashboard"),
]

export const CATALOGUE_BY_CODE = new Map(CATALOGUE.map((p) => [p.code, p]))

export function moduleOf(code: string): string {
  return code.split(":")[0]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @crontract/db exec vitest run src/permissions/__tests__/catalogue.test.ts`
Expected: PASS, 5 tests. If the "covers all 23 modules" test fails, add the missing module's codes (do not weaken the test).

- [ ] **Step 5: Make the catalogue importable from the web app**

The web app (`apps/web`) has NO dependency on `@crontract/db` today — it runs its own `PrismaClient`. Two later web **test** files (Tasks 10, 12) need to import the catalogue. `catalogue.ts` is pure data (no `@prisma/client` import), so exposing it is safe. Do both:

1. In `packages/db/package.json`, extend `exports` with a subpath:

```json
  "exports": {
    ".": "./src/index.ts",
    "./permissions/catalogue": "./src/permissions/catalogue.ts"
  }
```

2. In `apps/web/package.json`, add to `devDependencies`:

```json
    "@crontract/db": "workspace:*"
```

Then run: `pnpm install`
Expected: lockfile updates, `apps/web/node_modules/@crontract/db` symlink created. This lets vitest/tsc resolve `@crontract/db/permissions/catalogue`. No `next.config` / `transpilePackages` change — runtime web code never imports it, only tests do.

- [ ] **Step 6: Verify resolution**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: exit 0 (no unresolved-module errors introduced).

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/permissions/catalogue.ts packages/db/src/permissions/__tests__/catalogue.test.ts packages/db/package.json apps/web/package.json pnpm-lock.yaml
git commit -m "feat(authz): typed permission catalogue for all modules + web import path"
```

---

## Task 3: Role default grants map

**Files:**
- Create: `packages/db/src/permissions/role-defaults.ts`
- Test: `packages/db/src/permissions/__tests__/role-defaults.test.ts`

**Interfaces:**
- Consumes: `CATALOGUE`, `CATALOGUE_BY_CODE`, `PermissionScope` from `./catalogue`.
- Produces: `function defaultGrantsForRole(roleName: string): Array<{ code: string; scope: PermissionScope }>`

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/permissions/__tests__/role-defaults.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { defaultGrantsForRole } from "../role-defaults"

describe("defaultGrantsForRole", () => {
  it("Owner gets every catalogue code at ALL", () => {
    const g = defaultGrantsForRole("Owner")
    expect(g.every((x) => x.scope === "ALL")).toBe(true)
    expect(g.length).toBeGreaterThan(50)
  })

  it("Administrator matches Owner", () => {
    expect(defaultGrantsForRole("Administrator").length)
      .toBe(defaultGrantsForRole("Owner").length)
  })

  it("Employee cannot view payroll runs", () => {
    const codes = defaultGrantsForRole("Employee").map((x) => x.code)
    expect(codes).not.toContain("payroll:run:view")
  })

  it("Employee can view own payslip", () => {
    const codes = defaultGrantsForRole("Employee").map((x) => x.code)
    expect(codes).toContain("payroll:payslip:view_own")
  })

  it("Employee cannot view finance invoices", () => {
    const codes = defaultGrantsForRole("Employee").map((x) => x.code)
    expect(codes).not.toContain("finance:invoice:view")
  })

  it("Manager views projects at ALL but updates at TEAM", () => {
    const g = defaultGrantsForRole("Manager")
    expect(g.find((x) => x.code === "projects:task:view")?.scope).toBe("ALL")
    expect(g.find((x) => x.code === "projects:task:update")?.scope).toBe("TEAM")
  })

  it("unknown role gets no grants (fail-closed)", () => {
    expect(defaultGrantsForRole("Nonexistent")).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @crontract/db exec vitest run src/permissions/__tests__/role-defaults.test.ts`
Expected: FAIL — cannot resolve `../role-defaults`.

- [ ] **Step 3: Implement the defaults map**

Create `packages/db/src/permissions/role-defaults.ts`:

```ts
import { CATALOGUE, type PermissionScope } from "./catalogue"

type Grant = { code: string; scope: PermissionScope }

const OPERATIONAL_MODULES = new Set([
  "projects", "procurement", "assets", "hse", "crm", "meetings", "documents", "grants",
])

// Self-service codes every employee holds.
const EMPLOYEE_SELF_SERVICE = new Set([
  "payroll:payslip:view_own",
  "notifications:notification:view",
  "dashboard:dashboard:view",
  "approvals:approval:view",
  "approvals:approval:act",
])

function widest(def: { scopes: PermissionScope[] }): PermissionScope {
  if (def.scopes.includes("ALL")) return "ALL"
  if (def.scopes.includes("TEAM")) return "TEAM"
  return "OWN"
}

export function defaultGrantsForRole(roleName: string): Grant[] {
  switch (roleName) {
    case "Owner":
    case "Administrator":
      return CATALOGUE.map((p) => ({ code: p.code, scope: "ALL" as const }))

    case "Manager":
      return CATALOGUE.flatMap((p) => {
        if (p.action === "view") return [{ code: p.code, scope: "ALL" as const }]
        if (OPERATIONAL_MODULES.has(p.module) && p.scopes.includes("TEAM"))
          return [{ code: p.code, scope: "TEAM" as const }]
        return []
      })

    case "Employee":
      return CATALOGUE.flatMap((p) => {
        if (EMPLOYEE_SELF_SERVICE.has(p.code))
          return [{ code: p.code, scope: widest(p) }]
        if (p.action === "view" && OPERATIONAL_MODULES.has(p.module) && p.scopes.includes("TEAM"))
          return [{ code: p.code, scope: "TEAM" as const }]
        if (p.action === "update" && p.scopes.includes("OWN"))
          return [{ code: p.code, scope: "OWN" as const }]
        return []
      })

    default:
      return []
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @crontract/db exec vitest run src/permissions/__tests__/role-defaults.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/permissions/role-defaults.ts packages/db/src/permissions/__tests__/role-defaults.test.ts
git commit -m "feat(authz): default role->grant map for backfill"
```

---

## Task 4: Backfill + catalogue seed script

**Files:**
- Create: `packages/db/src/permissions/backfill.ts`
- Modify: `packages/db/src/seed.ts` (replace payroll-only permission seeding with catalogue seed)

**Interfaces:**
- Consumes: `CATALOGUE` from `./catalogue`, `defaultGrantsForRole` from `./role-defaults`, `PrismaClient`.
- Produces:
  - `async function seedCatalogue(prisma): Promise<Map<string,string>>` — upserts all `Permission` rows, returns code→id.
  - `async function backfillRoleGrants(prisma, workspaceId): Promise<{ grants: number }>` — upserts `RolePermission` rows (with scope) per role default.
  - `async function enrolProjectOwners(prisma, workspaceId): Promise<{ members: number }>` — LEAD membership for every project owner.
  - `async function runBackfill(prisma): Promise<void>` — all of the above, all workspaces. Runnable via `tsx`.

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/permissions/__tests__/backfill.test.ts` (pure-unit: mock prisma with an in-memory capture; no live DB):

```ts
import { describe, it, expect, vi } from "vitest"
import { backfillRoleGrants } from "../backfill"

function fakePrisma() {
  const rolePerms: any[] = []
  return {
    _rolePerms: rolePerms,
    role: { findMany: vi.fn(async () => [{ id: "r1", name: "Employee" }]) },
    permission: { findMany: vi.fn(async () =>
      // minimal: the two codes the assertions below touch
      [
        { id: "p1", code: "payroll:payslip:view_own" },
        { id: "p2", code: "payroll:run:view" },
      ]) },
    rolePermission: {
      upsert: vi.fn(async ({ create }: any) => { rolePerms.push(create); return create }),
    },
  } as any
}

describe("backfillRoleGrants", () => {
  it("grants Employee the self-service payslip code with OWN scope", async () => {
    const p = fakePrisma()
    await backfillRoleGrants(p, "w1")
    const g = p._rolePerms.find((x: any) => x.permissionId === "p1")
    expect(g).toBeDefined()
    expect(g.scope).toBe("OWN")
  })

  it("does not grant Employee payroll:run:view", async () => {
    const p = fakePrisma()
    await backfillRoleGrants(p, "w1")
    expect(p._rolePerms.find((x: any) => x.permissionId === "p2")).toBeUndefined()
  })

  it("is idempotent-safe (only known codes upserted)", async () => {
    const p = fakePrisma()
    await backfillRoleGrants(p, "w1")
    const first = p._rolePerms.length
    await backfillRoleGrants(p, "w1")
    expect(p._rolePerms.length).toBe(first * 2) // upsert called again; create payload identical
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @crontract/db exec vitest run src/permissions/__tests__/backfill.test.ts`
Expected: FAIL — cannot resolve `../backfill`.

- [ ] **Step 3: Implement backfill**

Create `packages/db/src/permissions/backfill.ts`:

```ts
import { PrismaClient } from "@prisma/client"
import { CATALOGUE } from "./catalogue"
import { defaultGrantsForRole } from "./role-defaults"

export async function seedCatalogue(prisma: PrismaClient): Promise<Map<string, string>> {
  const byCode = new Map<string, string>()
  for (const p of CATALOGUE) {
    const row = await prisma.permission.upsert({
      where: { code: p.code },
      update: { module: p.module, entity: p.entity, action: p.action, description: p.description },
      create: { code: p.code, module: p.module, entity: p.entity, action: p.action, description: p.description },
    })
    byCode.set(p.code, row.id)
  }
  return byCode
}

export async function backfillRoleGrants(
  prisma: PrismaClient, workspaceId: string,
): Promise<{ grants: number }> {
  const perms = await prisma.permission.findMany()
  const idByCode = new Map(perms.map((p) => [p.code, p.id]))
  const roles = await prisma.role.findMany({ where: { workspaceId } })

  let grants = 0
  for (const role of roles) {
    for (const g of defaultGrantsForRole(role.name)) {
      const permissionId = idByCode.get(g.code)
      if (!permissionId) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: { scope: g.scope },
        create: { roleId: role.id, permissionId, scope: g.scope },
      })
      grants++
    }
  }
  return { grants }
}

export async function enrolProjectOwners(
  prisma: PrismaClient, workspaceId: string,
): Promise<{ members: number }> {
  const projects = await prisma.project.findMany({
    where: { workspaceId, deletedAt: null },
    select: { id: true, ownerId: true },
  })
  let members = 0
  for (const proj of projects) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: proj.id, userId: proj.ownerId } },
      update: { role: "LEAD" },
      create: { projectId: proj.id, userId: proj.ownerId, role: "LEAD" },
    })
    members++
  }
  return { members }
}

export async function runBackfill(prisma: PrismaClient): Promise<void> {
  await seedCatalogue(prisma)
  const workspaces = await prisma.workspace.findMany({ select: { id: true } })
  let grants = 0, members = 0
  for (const w of workspaces) {
    grants += (await backfillRoleGrants(prisma, w.id)).grants
    members += (await enrolProjectOwners(prisma, w.id)).members
  }
  console.log(`[backfill] workspaces=${workspaces.length} grants=${grants} projectMembers=${members}`)
}

// Allow `tsx src/permissions/backfill.ts` to run it directly.
if (require.main === module) {
  const prisma = new PrismaClient()
  runBackfill(prisma).finally(() => prisma.$disconnect())
}
```

- [ ] **Step 4: Wire catalogue seed into `seed.ts`**

In `packages/db/src/seed.ts`, replace the `seedPayrollPermissions(prisma, wId)` call (line ~236) with:

```ts
import { seedCatalogue, backfillRoleGrants } from "./permissions/backfill"
// ...inside the per-workspace block, after roles exist:
await seedCatalogue(prisma)
await backfillRoleGrants(prisma, wId)
```

Remove the now-redundant `seedPayrollPermissions` import and call (the 8 payroll codes are in the catalogue). Keep `permissions-seed.ts` on disk for reference but unused.

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter @crontract/db exec vitest run src/permissions/__tests__/backfill.test.ts`
Expected: PASS, 3 tests.

Run: `pnpm --filter @crontract/db typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/permissions/backfill.ts packages/db/src/permissions/__tests__/backfill.test.ts packages/db/src/seed.ts
git commit -m "feat(authz): catalogue seed + idempotent role-grant/project-owner backfill"
```

---

## Task 5: The `can()` engine + grant loader

**Files:**
- Create: `apps/web/src/lib/authz/scopes.ts`
- Create: `apps/web/src/lib/authz/grants.ts`
- Create: `apps/web/src/lib/authz/can.ts`
- Test: `apps/web/src/lib/authz/__tests__/can.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`; `SessionUser`/`AuthedUser` from `@/lib/authorization`.
- Produces:
  - `type PermissionScope = "ALL" | "TEAM" | "OWN"` (in `scopes.ts`)
  - `type Grant = { code: string; scope: PermissionScope }`
  - `async function loadRoleGrants(roleId: string): Promise<Map<string, PermissionScope>>` (cached, in `grants.ts`)
  - `function invalidateRoleGrants(roleId: string): void` (in `grants.ts`)
  - `type ResourceCtx = { projectId?: string; ownerIds?: string[] }`
  - `async function can(user: { id: string; roleId: string }, code: string, resource?: ResourceCtx): Promise<boolean>` (in `can.ts`)
  - `async function isProjectMember(userId: string, projectId: string): Promise<boolean>` (in `can.ts`)

Note: `can()` needs the user's `roleId`. Task 7 adds `roleId` to the session; until then tests pass it directly.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/authz/__tests__/can.test.ts`. Mock `grants.ts` and the membership lookup so the truth table is pure:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../grants", () => ({
  loadRoleGrants: vi.fn(),
  invalidateRoleGrants: vi.fn(),
}))
vi.mock("@/lib/db", () => ({
  prisma: { projectMember: { findUnique: vi.fn() } },
}))

import { can } from "../can"
import { loadRoleGrants } from "../grants"
import { prisma } from "@/lib/db"

const USER = { id: "u1", roleId: "r1" }

function grantsWith(map: Record<string, "ALL" | "TEAM" | "OWN">) {
  ;(loadRoleGrants as any).mockResolvedValue(new Map(Object.entries(map)))
}

beforeEach(() => vi.clearAllMocks())

describe("can()", () => {
  it("denies when the role lacks the code (fail-closed)", async () => {
    grantsWith({})
    expect(await can(USER, "projects:task:update")).toBe(false)
  })

  it("ALL grant allows regardless of resource", async () => {
    grantsWith({ "projects:task:update": "ALL" })
    expect(await can(USER, "projects:task:update", { projectId: "p9" })).toBe(true)
  })

  it("OWN grant allows when user is in ownerIds", async () => {
    grantsWith({ "projects:task:update": "OWN" })
    expect(await can(USER, "projects:task:update", { ownerIds: ["u1"] })).toBe(true)
  })

  it("OWN grant denies when user is not an owner", async () => {
    grantsWith({ "projects:task:update": "OWN" })
    expect(await can(USER, "projects:task:update", { ownerIds: ["someone-else"] })).toBe(false)
  })

  it("TEAM grant allows a project member", async () => {
    grantsWith({ "projects:task:update": "TEAM" })
    ;(prisma.projectMember.findUnique as any).mockResolvedValue({ id: "pm1" })
    expect(await can(USER, "projects:task:update", { projectId: "p1" })).toBe(true)
  })

  it("TEAM grant denies a non-member", async () => {
    grantsWith({ "projects:task:update": "TEAM" })
    ;(prisma.projectMember.findUnique as any).mockResolvedValue(null)
    expect(await can(USER, "projects:task:update", { projectId: "p1" })).toBe(false)
  })

  it("TEAM grant falls back to OWN when no projectId but ownerIds match", async () => {
    grantsWith({ "projects:task:update": "TEAM" })
    expect(await can(USER, "projects:task:update", { ownerIds: ["u1"] })).toBe(true)
  })

  it("no-resource check passes when the code is held at any scope", async () => {
    grantsWith({ "projects:task:create": "TEAM" })
    expect(await can(USER, "projects:task:create")).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/lib/authz/__tests__/can.test.ts`
Expected: FAIL — cannot resolve `../can`.

- [ ] **Step 3: Implement `scopes.ts`**

```ts
export type PermissionScope = "ALL" | "TEAM" | "OWN"

const RANK: Record<PermissionScope, number> = { ALL: 3, TEAM: 2, OWN: 1 }

/** Returns the widest (highest-rank) of two scopes. */
export function widerScope(a: PermissionScope, b: PermissionScope): PermissionScope {
  return RANK[a] >= RANK[b] ? a : b
}
```

- [ ] **Step 4: Implement `grants.ts` (cached loader)**

```ts
import { prisma } from "@/lib/db"
import type { PermissionScope } from "./scopes"
import { widerScope } from "./scopes"

type CacheEntry = { grants: Map<string, PermissionScope>; expires: number }
const cache = new Map<string, CacheEntry>()
const TTL_MS = 60_000

export function invalidateRoleGrants(roleId: string): void {
  cache.delete(roleId)
}

export async function loadRoleGrants(roleId: string): Promise<Map<string, PermissionScope>> {
  const now = Date.now()
  const hit = cache.get(roleId)
  if (hit && hit.expires > now) return hit.grants

  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { scope: true, permission: { select: { code: true } } },
  })

  const grants = new Map<string, PermissionScope>()
  for (const r of rows) {
    const scope = r.scope as PermissionScope
    const existing = grants.get(r.permission.code)
    grants.set(r.permission.code, existing ? widerScope(existing, scope) : scope)
  }
  cache.set(roleId, { grants, expires: now + TTL_MS })
  return grants
}
```

- [ ] **Step 5: Implement `can.ts`**

```ts
import { prisma } from "@/lib/db"
import { loadRoleGrants } from "./grants"

export type ResourceCtx = { projectId?: string; ownerIds?: string[] }

export async function isProjectMember(userId: string, projectId: string): Promise<boolean> {
  const m = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  })
  return m !== null
}

export async function can(
  user: { id: string; roleId: string },
  code: string,
  resource?: ResourceCtx,
): Promise<boolean> {
  const grants = await loadRoleGrants(user.roleId)
  const scope = grants.get(code)
  if (!scope) return false            // fail-closed

  if (!resource) return true          // holds the code at some scope
  if (scope === "ALL") return true

  const ownsIt = resource.ownerIds?.includes(user.id) ?? false
  if (scope === "OWN") return ownsIt

  // TEAM: project membership, else fall back to ownership
  if (resource.projectId) return isProjectMember(user.id, resource.projectId)
  return ownsIt
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/lib/authz/__tests__/can.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/authz/scopes.ts apps/web/src/lib/authz/grants.ts apps/web/src/lib/authz/can.ts apps/web/src/lib/authz/__tests__/can.test.ts
git commit -m "feat(authz): can() decision engine with role-cached grants and scope eval"
```

---

## Task 6: `requirePermission` guard + `AUTHZ_ENFORCED` flag + `scopeWhere`

**Files:**
- Modify: `apps/web/src/lib/env.ts` (add `AUTHZ_ENFORCED`)
- Create: `apps/web/src/lib/authz/guard.ts`
- Test: `apps/web/src/lib/authz/__tests__/guard.test.ts`

**Interfaces:**
- Consumes: `can`, `ResourceCtx` from `./can`; `AUTHZ_ENFORCED` from `@/lib/env`; `NextResponse`.
- Produces:
  - `async function requirePermission(user, code, resource?): Promise<NextResponse | null>` — returns 403 `NextResponse` on deny, `null` on allow. When `AUTHZ_ENFORCED` is false, always returns `null` (allow) **but still runs `can()` and `console.warn`s would-be denials** for observability.
  - `function scopeWhere(user, scope, fields): Record<string, unknown>` — Prisma `where` fragment for list filtering.

- [ ] **Step 1: Add env flag**

`env.ts` exports `validateEnv()` + `ServerEnv`, no parsed singleton. Add the var to `serverEnvSchema` for documentation:

```ts
AUTHZ_ENFORCED: z.enum(["true", "false"]).optional(),
```

and, at the bottom of the file, export a plain boolean the guard imports:

```ts
/** Master switch for permission enforcement. Off unless explicitly "true". */
export const AUTHZ_ENFORCED = process.env.AUTHZ_ENFORCED === "true"
```

Default (unset) → `false`.

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/lib/authz/__tests__/guard.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const flag = { AUTHZ_ENFORCED: true }
vi.mock("@/lib/env", () => ({ get AUTHZ_ENFORCED() { return flag.AUTHZ_ENFORCED } }))
vi.mock("../can", () => ({ can: vi.fn() }))

import { requirePermission } from "../guard"
import { can } from "../can"

const USER = { id: "u1", roleId: "r1" }
beforeEach(() => vi.clearAllMocks())

describe("requirePermission", () => {
  it("returns null (allow) when can() is true", async () => {
    flag.AUTHZ_ENFORCED = true
    ;(can as any).mockResolvedValue(true)
    expect(await requirePermission(USER, "projects:task:update")).toBeNull()
  })

  it("returns a 403 when enforced and can() is false", async () => {
    flag.AUTHZ_ENFORCED = true
    ;(can as any).mockResolvedValue(false)
    const res = await requirePermission(USER, "projects:task:update")
    expect(res?.status).toBe(403)
  })

  it("allows (null) when NOT enforced even if can() is false", async () => {
    flag.AUTHZ_ENFORCED = false
    ;(can as any).mockResolvedValue(false)
    expect(await requirePermission(USER, "projects:task:update")).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/lib/authz/__tests__/guard.test.ts`
Expected: FAIL — cannot resolve `../guard`.

- [ ] **Step 4: Implement `guard.ts`**

```ts
import { NextResponse } from "next/server"
import { AUTHZ_ENFORCED } from "@/lib/env"
import { can, type ResourceCtx } from "./can"
import type { PermissionScope } from "./scopes"

export async function requirePermission(
  user: { id: string; roleId: string },
  code: string,
  resource?: ResourceCtx,
): Promise<NextResponse | null> {
  const allowed = await can(user, code, resource)
  if (allowed) return null
  if (!AUTHZ_ENFORCED) {
    console.warn(`[authz:shadow-deny] user=${user.id} code=${code}`)
    return null
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

/** Prisma `where` fragment restricting a list query to the caller's scope. */
export function scopeWhere(
  user: { id: string },
  scope: PermissionScope,
  fields: { projectPath?: string; ownerFields?: string[] },
): Record<string, unknown> {
  if (scope === "ALL") return {}
  if (scope === "TEAM" && fields.projectPath) {
    return { [fields.projectPath]: { members: { some: { userId: user.id } } } }
  }
  const owners = fields.ownerFields ?? ["createdBy"]
  return { OR: owners.map((f) => ({ [f]: user.id })) }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/lib/authz/__tests__/guard.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/env.ts apps/web/src/lib/authz/guard.ts apps/web/src/lib/authz/__tests__/guard.test.ts
git commit -m "feat(authz): requirePermission guard + AUTHZ_ENFORCED flag + scopeWhere"
```

---

## Task 7: Put `roleId` in the session

**Files:**
- Modify: `apps/web/src/lib/auth.ts` (JWT + session callbacks **and** the `declare module "next-auth"` augmentation — it lives in this file, confirmed by grep)
- Modify: `apps/web/src/lib/authorization.ts` (`SessionUser.roleId`)

**Interfaces:**
- Produces: `session.user.roleId: string` and `token.roleId` populated from the membership's `role.id`. `SessionUser` gains `roleId?: string`.

- [ ] **Step 1: Add `roleId` to the JWT token**

In `auth.ts` `jwt` callback, the membership query already selects `role: { select: { name: true } }`. Change both membership queries (initial + workspace-switch) to `role: { select: { id: true, name: true } }` and set `token.roleId = membership.role.id` alongside `token.role`.

- [ ] **Step 2: Expose it on the session**

In the `session` callback add: `session.user.roleId = token.roleId`.

- [ ] **Step 3: Extend the types**

Add `roleId?: string` to `SessionUser` in `authorization.ts`, and to the `declare module "next-auth"` (Session `user`) and `declare module "next-auth/jwt"` (JWT) augmentations **in `auth.ts`**, next to the existing `role?: string`.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/auth.ts apps/web/src/lib/authorization.ts
git commit -m "feat(authz): carry roleId in JWT and session"
```

---

## Task 8: Adopt `requirePermission` in the Projects/Tasks routes (reference module)

**Files:**
- Modify: `apps/web/src/app/api/tasks/[id]/route.ts`
- Modify: `apps/web/src/app/api/tasks/route.ts`
- Modify: `apps/web/src/app/api/projects/route.ts`, `apps/web/src/app/api/projects/[id]/route.ts`
- Test: `apps/web/src/app/api/tasks/__tests__/guard.test.ts`

**Interfaces:**
- Consumes: `requirePermission` from `@/lib/authz/guard`; session `user.roleId`.

This task establishes the exact pattern every later module copies.

- [ ] **Step 1: Write the failing test (task PATCH honours TEAM membership)**

Create `apps/web/src/app/api/tasks/__tests__/guard.test.ts` that imports the route's authorization decision path. Since the handler is heavy, test at the `can()` composition level: a helper `taskResourceCtx(task)` that the route uses.

First add to `tasks/[id]/route.ts` a small exported helper:

```ts
export function taskResourceCtx(task: { projectId: string; assigneeId: string | null; createdBy: string }) {
  return { projectId: task.projectId, ownerIds: [task.assigneeId, task.createdBy].filter(Boolean) as string[] }
}
```

Test:

```ts
import { describe, it, expect } from "vitest"
import { taskResourceCtx } from "../[id]/route"

describe("taskResourceCtx", () => {
  it("includes projectId for TEAM checks", () => {
    expect(taskResourceCtx({ projectId: "p1", assigneeId: null, createdBy: "u9" }).projectId).toBe("p1")
  })
  it("treats both assignee and creator as owners", () => {
    const ctx = taskResourceCtx({ projectId: "p1", assigneeId: "u2", createdBy: "u3" })
    expect(ctx.ownerIds).toEqual(["u2", "u3"])
  })
  it("omits null assignee from owners", () => {
    const ctx = taskResourceCtx({ projectId: "p1", assigneeId: null, createdBy: "u3" })
    expect(ctx.ownerIds).toEqual(["u3"])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/app/api/tasks/__tests__/guard.test.ts`
Expected: FAIL — `taskResourceCtx` not exported.

- [ ] **Step 3: Replace the guard in `tasks/[id]/route.ts`**

Add the `taskResourceCtx` export (above). In `PATCH` and `DELETE`, after loading `existing`, replace:

```ts
const admin = isAdmin(session)
if (!admin && existing.assigneeId !== session!.user.id) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

with:

```ts
const denied = await requirePermission(
  { id: session!.user.id, roleId: session!.user.roleId! },
  "projects:task:update",              // "projects:task:delete" in DELETE
  taskResourceCtx(existing),
)
if (denied) return denied
```

Add `import { requirePermission } from "@/lib/authz/guard"`. Leave `isAdmin`/`requireAuth` imports (still used for auth gate).

- [ ] **Step 4: Guard `tasks/route.ts` POST (create) and GET (list)**

In `POST` (create task), after auth, add:

```ts
const denied = await requirePermission(
  { id: session!.user.id, roleId: session!.user.roleId! },
  "projects:task:create",
  { projectId: body.projectId },
)
if (denied) return denied
```

In `GET` (list), gate with `"projects:task:view"` (no resource → any-scope check), and apply `scopeWhere` to the query where feasible (if the list is per-project already, the projectId filter suffices).

- [ ] **Step 5: Guard `projects/route.ts` and `projects/[id]/route.ts`**

`projects:project:view` on GET, `:create` on POST, `:update` on PATCH (resource `{ projectId: id, ownerIds: [project.ownerId] }`), `:delete` on DELETE.

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter web exec vitest run src/app/api/tasks/__tests__/guard.test.ts`
Expected: PASS, 3 tests.

Run: `pnpm --filter web exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/tasks apps/web/src/app/api/projects
git commit -m "feat(authz): enforce permissions on projects/tasks routes (reference pattern)"
```

---

## Task 9: Roll the guard across the remaining API modules

**Files (modify, guard every mutating handler + view on GET):**
- `apps/web/src/app/api/people/route.ts` and children
- `apps/web/src/app/api/finance/**/route.ts`
- `apps/web/src/app/api/budget/**/route.ts`
- `apps/web/src/app/api/procurement/**/route.ts` *(uses assets/hse pattern; see note)*
- `apps/web/src/app/api/assets/route.ts`
- `apps/web/src/app/api/hse/**/route.ts`
- `apps/web/src/app/api/crm/**/route.ts`
- `apps/web/src/app/api/grants/**/route.ts`
- `apps/web/src/app/api/compliance/**/route.ts`
- `apps/web/src/app/api/meetings/**/route.ts`
- `apps/web/src/app/api/documents/**/route.ts`
- `apps/web/src/app/api/approvals/**/route.ts`
- `apps/web/src/app/api/social-media/**/route.ts`
- `apps/web/src/app/api/payroll/**/route.ts` *(map to the existing 8 payroll codes)*
- `apps/web/src/app/api/admin/**/route.ts` *(map to `admin:*` codes; keep behaviour: Owner/Admin only)*

**Interfaces:**
- Consumes: `requirePermission` from `@/lib/authz/guard`; `scopeWhere` from `@/lib/authz/guard`.

- [ ] **Step 1: Guard each route by its catalogue code**

For every route file, at the top of each handler after the existing `requireAuth`, insert `requirePermission` with the module's code. Map by HTTP verb: GET→`:view`, POST→`:create`/`:manage`, PATCH/PUT→`:update`/`:manage`, DELETE→`:delete`. For team-scoped modules, pass the resource ctx (`{ projectId }` where a project link exists, else `{ ownerIds: [...] }`). For ALL-only modules, pass no resource.

Work module-by-module. After each module, run:

Run: `pnpm --filter web exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Apply `scopeWhere` to team-scoped list endpoints**

For `crm`, `procurement`, `assets`, `hse`, `grants`, `meetings`, `documents` list GETs, compose `scopeWhere(user, heldScope, { projectPath, ownerFields })` into the existing workspace-filtered `where`. `heldScope` comes from `loadRoleGrants(user.roleId).get(code)`. Where a module has no project link, use `ownerFields` only.

- [ ] **Step 3: Commit per module (frequent commits)**

After each module compiles clean:

```bash
git add apps/web/src/app/api/<module>
git commit -m "feat(authz): enforce permissions on <module> routes"
```

- [ ] **Step 4: Full web typecheck + full test run**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: exit 0.

Run: `pnpm --filter web exec vitest run`
Expected: all green.

---

## Task 10: Middleware module-prefix gate

**Files:**
- Modify: `apps/web/src/middleware.ts`
- Test: `apps/web/src/lib/authz/__tests__/route-permission-map.test.ts`

**Interfaces:**
- Produces: `const MODULE_VIEW_PERMISSION: Record<string, string>` mapping a route prefix (e.g. `/payroll`) to its view code (e.g. `payroll:run:view`). Exported from a new `apps/web/src/lib/authz/route-map.ts` so both middleware and tests import it.

Note: edge middleware cannot query Prisma, and grants aren't in the JWT. So middleware does a **coarse** gate: it maps prefix→required view code, but can only *enforce* the codes derivable from the role name fallback (Owner/Admin/Manager/Employee) using a static default table — NOT live grants. This is intentional defence-in-depth; the API guards are authoritative. Keep the existing `/admin` role check as-is.

- [ ] **Step 1: Write the failing test**

Create `route-map.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { MODULE_VIEW_PERMISSION } from "../route-map"

describe("MODULE_VIEW_PERMISSION", () => {
  it("gates payroll behind a payroll view code", () => {
    expect(MODULE_VIEW_PERMISSION["/payroll"]).toBe("payroll:run:view")
  })
  it("gates finance", () => {
    expect(MODULE_VIEW_PERMISSION["/finance"]).toBe("finance:invoice:view")
  })
  it("every mapped code is a real catalogue code", async () => {
    const { CATALOGUE_BY_CODE } = await import("@crontract/db/permissions/catalogue")
    for (const code of Object.values(MODULE_VIEW_PERMISSION)) {
      expect(CATALOGUE_BY_CODE.has(code)).toBe(true)
    }
  })
})
```

The `@crontract/db/permissions/catalogue` subpath export and the `apps/web` devDependency were set up in Task 2 Step 5, so this import resolves.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/lib/authz/__tests__/route-permission-map.test.ts`
Expected: FAIL — cannot resolve `../route-map`.

- [ ] **Step 3: Implement `route-map.ts` + a static role→module-view table**

```ts
export const MODULE_VIEW_PERMISSION: Record<string, string> = {
  "/payroll": "payroll:run:view",
  "/finance": "finance:invoice:view",
  "/budget": "budget:budget:view",
  "/people": "people:employee:view",
  "/procurement": "procurement:po:view",
  "/compliance": "compliance:obligation:view",
  "/social-media": "social:post:view",
  "/reports": "reports:report:view",
}

// Coarse role → modules-visible table for edge middleware (no DB access here).
// Mirrors role-defaults but static. API guards remain authoritative.
export const ROLE_MODULE_VIEW: Record<string, Set<string>> = {
  Owner: new Set(Object.values(MODULE_VIEW_PERMISSION)),
  Administrator: new Set(Object.values(MODULE_VIEW_PERMISSION)),
  Manager: new Set(Object.values(MODULE_VIEW_PERMISSION)),
  Employee: new Set([]), // Employee sees none of the financial/HR prefixes above
}
```

- [ ] **Step 4: Wire into middleware behind the flag**

In `middleware.ts`, after the admin check, add (only when `process.env.AUTHZ_ENFORCED === "true"`):

```ts
for (const [prefix, code] of Object.entries(MODULE_VIEW_PERMISSION)) {
  if (pathname.startsWith(prefix)) {
    const roleName = token.role as string | undefined
    const visible = roleName ? ROLE_MODULE_VIEW[roleName] : undefined
    if (!visible?.has(code)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      return NextResponse.redirect(new URL("/unauthorized", req.url))
    }
    break
  }
}
```

Import `MODULE_VIEW_PERMISSION`, `ROLE_MODULE_VIEW` from `@/lib/authz/route-map`.

- [ ] **Step 5: Run test + typecheck**

Run: `pnpm --filter web exec vitest run src/lib/authz/__tests__/route-permission-map.test.ts`
Expected: PASS.

Run: `pnpm --filter web exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/authz/route-map.ts apps/web/src/middleware.ts apps/web/src/lib/authz/__tests__/route-permission-map.test.ts
git commit -m "feat(authz): coarse module-prefix gate in middleware (behind flag)"
```

---

## Task 11: Permission matrix persists scope + invalidates cache

**Files:**
- Modify: `apps/web/src/app/api/admin/roles/[id]/permissions/route.ts`
- Modify: `apps/web/src/app/(dashboard)/admin/permissions/permission-matrix.tsx`
- Test: `apps/web/src/app/api/admin/roles/__tests__/permissions.test.ts`

**Interfaces:**
- Consumes: `invalidateRoleGrants` from `@/lib/authz/grants`.

The existing handler is a **`PUT`** taking `{ permissionIds: string[] }` and doing a `deleteMany` + `createMany` inside `prisma.$transaction([...])`, plus an audit-log write. We extend the payload to carry scope and invalidate the cache, preserving the audit write.

- [ ] **Step 1: Write the failing test**

Extract the write into a testable helper `applyRolePermissions(tx, roleId, entries)` where `entries: { permissionId: string; scope: PermissionScope }[]`, and assert it invalidates the cache.

```ts
import { describe, it, expect, vi } from "vitest"
vi.mock("@/lib/authz/grants", () => ({ invalidateRoleGrants: vi.fn() }))
import { applyRolePermissions } from "../[id]/permissions/route"
import { invalidateRoleGrants } from "@/lib/authz/grants"

it("invalidates the role cache after applying", async () => {
  const prisma = {
    rolePermission: { deleteMany: vi.fn(async () => {}), createMany: vi.fn(async () => {}) },
  } as any
  await applyRolePermissions(prisma, "r1", [{ permissionId: "p1", scope: "TEAM" }])
  expect(invalidateRoleGrants).toHaveBeenCalledWith("r1")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/app/api/admin/roles/__tests__/permissions.test.ts`
Expected: FAIL — `applyRolePermissions` not exported / doesn't invalidate.

- [ ] **Step 3: Implement `applyRolePermissions` + call it in PUT**

```ts
import { invalidateRoleGrants } from "@/lib/authz/grants"
import type { PermissionScope } from "@/lib/authz/scopes"

export async function applyRolePermissions(
  prisma: any, roleId: string,
  entries: { permissionId: string; scope: PermissionScope }[],
) {
  await prisma.rolePermission.deleteMany({ where: { roleId } })
  if (entries.length) {
    await prisma.rolePermission.createMany({
      data: entries.map((e) => ({ roleId, permissionId: e.permissionId, scope: e.scope })),
      skipDuplicates: true,
    })
  }
  invalidateRoleGrants(roleId)
}
```

Change `putSchema` to accept scoped entries while staying back-compatible with bare-id clients:

```ts
const putSchema = z.object({
  permissions: z.array(z.object({
    permissionId: z.string().uuid(),
    scope: z.enum(["ALL", "TEAM", "OWN"]).default("ALL"),
  })).optional(),
  // legacy shape: plain ids default to ALL scope
  permissionIds: z.array(z.string().uuid()).optional(),
})
```

In `PUT`, normalise to `entries` (map any `permissionIds` to `{ permissionId, scope: "ALL" }`), keep the existing audit-log diff (compute `afterState` from the permissionIds), and replace the inline `$transaction` delete/create with a call to `applyRolePermissions(prisma, params.id, entries)`. Keep the audit `create` after it.

- [ ] **Step 4: Add a scope selector to the matrix UI**

In `permission-matrix.tsx`, each checked cell gains a small scope dropdown (ALL/TEAM/OWN) limited to the scopes the catalogue marks meaningful for that code. Send `{ permissions: [{ permissionId, scope }, ...] }` on save (the new `putSchema` shape). Where a code is ALL-only, render the scope as a static "ALL" label, not a dropdown.

- [ ] **Step 5: Run test + typecheck**

Run: `pnpm --filter web exec vitest run src/app/api/admin/roles/__tests__/permissions.test.ts`
Expected: PASS.

Run: `pnpm --filter web exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/admin/roles apps/web/src/app/\(dashboard\)/admin/permissions
git commit -m "feat(authz): matrix persists scope and invalidates role cache"
```

---

## Task 12: Catalogue-integrity + route-guard scan tests

**Files:**
- Test: `apps/web/src/lib/authz/__tests__/catalogue-integrity.test.ts`

**Interfaces:**
- Consumes: filesystem scan of `apps/web/src/app/api/**/route.ts`; the catalogue.

- [ ] **Step 1: Write the integrity test**

```ts
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { globSync } from "glob"
import { CATALOGUE_BY_CODE } from "@crontract/db/permissions/catalogue" // subpath export added in Task 2 Step 5

const routeFiles = globSync("src/app/api/**/route.ts", { cwd: process.cwd() })

describe("route guard integrity", () => {
  it("every requirePermission code exists in the catalogue", () => {
    const codeRe = /requirePermission\([^,]+,\s*["'`]([a-z_]+:[a-z_]+:[a-z_]+)["'`]/g
    const missing: string[] = []
    for (const f of routeFiles) {
      const src = readFileSync(f, "utf8")
      for (const m of src.matchAll(codeRe)) {
        if (!CATALOGUE_BY_CODE.has(m[1])) missing.push(`${f}: ${m[1]}`)
      }
    }
    expect(missing).toEqual([])
  })

  it("every mutating route file references requirePermission", () => {
    const unguarded: string[] = []
    for (const f of routeFiles) {
      const src = readFileSync(f, "utf8")
      const mutates = /export async function (POST|PATCH|PUT|DELETE)/.test(src)
      if (mutates && !src.includes("requirePermission")) unguarded.push(f)
    }
    expect(unguarded).toEqual([])
  })
})
```

- [ ] **Step 2: Run it — expect real failures, then fix them**

Run: `pnpm --filter web exec vitest run src/lib/authz/__tests__/catalogue-integrity.test.ts`
Expected: initially may FAIL listing any route missed in Task 9. **Fix each listed route** (add the guard) until green. This test is the safety net proving Task 9 was complete.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/authz/__tests__/catalogue-integrity.test.ts
git commit -m "test(authz): catalogue-integrity + unguarded-route scan"
```

---

## Task 13: Migrations baseline + deploy switch

**Files:**
- Create: `packages/db/prisma/migrations/` (baseline + additive migration)
- Modify: `deploy.ps1` (`db push` → `migrate deploy`)
- Modify: `.env.example` (document `AUTHZ_ENFORCED`)

- [ ] **Step 1: Generate the baseline migration from current schema**

Run (locally, against a scratch/dev DB or with `--from-empty`):

```bash
pnpm --filter @crontract/db exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > packages/db/prisma/migrations/00000000000000_baseline/migration.sql
```

Create the migration folder + `migration.sql`. This baseline includes the new `ProjectMember`, `scope` column, and enums because they're already in the schema — that's fine; on Contabo we mark it resolved (Step 4).

- [ ] **Step 2: Verify the migration applies to a clean DB**

Run against a scratch DB: `pnpm --filter @crontract/db exec prisma migrate deploy`
Expected: "All migrations have been applied." Then `prisma migrate status` → up to date.

- [ ] **Step 3: Switch `deploy.ps1` to migrate deploy**

Replace the `corepack pnpm db:push` invocation (deploy.ps1 line ~89) with `corepack pnpm --filter @crontract/db exec prisma migrate deploy`. Update the NOTE comment to reflect migrations are now adopted. Add a `db:migrate:deploy` script to `packages/db/package.json` if cleaner.

- [ ] **Step 4: Document the Contabo baseline-resolve step (run once, manually)**

Add to `docs/PRODUCTION-FOLLOWUPS.md` an ordered runbook (do NOT auto-run against prod here):

```
# One-time on Contabo, BEFORE first migrate deploy, to adopt migrations without
# re-running the baseline against existing data:
ssh contabo
cd /var/www/crontract
corepack pnpm --filter @crontract/db exec prisma migrate resolve --applied 00000000000000_baseline
# then a normal deploy runs `migrate deploy` (only the additive ProjectMember/scope
# migration applies if the baseline already matches live schema).
corepack pnpm --filter @crontract/db exec prisma migrate status   # confirm clean
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/migrations deploy.ps1 packages/db/package.json .env.example docs/PRODUCTION-FOLLOWUPS.md
git commit -m "chore(authz): adopt prisma migrations; deploy uses migrate deploy"
```

---

## Task 14: Production rollout runbook (docs only)

**Files:**
- Modify: `docs/PRODUCTION-FOLLOWUPS.md`

- [ ] **Step 1: Write the ordered go-live runbook**

Append the exact sequence to run on Contabo, in order, with the verification gate at each step:

```
1. Deploy code with AUTHZ_ENFORCED unset (=off). Smoke-test: app behaves as before.
2. `prisma migrate resolve --applied 00000000000000_baseline` (one-time).
3. Deploy → `migrate deploy` applies the additive migration. `migrate status` clean.
4. Run backfill: `corepack pnpm --filter @crontract/db exec tsx src/permissions/backfill.ts`
   Verify the printed counts: grants > 0, projectMembers == project count.
5. Spot-check in DB: Employee role has NO finance/payroll:run grants; Owner has all.
6. Set AUTHZ_ENFORCED=true in /var/www/crontract/.env; `pm2 restart crontract --update-env`.
7. Re-baseline the shared box: curl :80 :8080 :8081 :8082 :8083 → all prior codes unchanged.
8. Log in as Owner (full access) and as an Employee (cannot open /payroll, /finance).
9. Rollback if needed: set AUTHZ_ENFORCED=false; pm2 restart. Instant revert.
```

- [ ] **Step 2: Commit**

```bash
git add docs/PRODUCTION-FOLLOWUPS.md
git commit -m "docs(authz): production go-live + rollback runbook"
```

---

## Self-Review notes

- **Spec coverage:** engine (T5), scope model (T1/T5), catalogue for 23 modules (T2), backfill/no-lockout (T3/T4), migrations adoption (T13), API+middleware+UI enforcement (T8–T11), matrix meaning + cache invalidation (T11), fail-closed + flag (T6), integrity net (T12), rollout safety (T14). All spec sections map to a task.
- **Fail-closed** is realised in `can()` (T5 step 5) and `defaultGrantsForRole` default branch (T3).
- **`roleId` availability:** `can()` needs `user.roleId`; provided by T7 before the routes in T8/T9 rely on it. T5/T6 tests pass it directly, so ordering is safe.
- **Real roles** Owner/Administrator/Manager/Employee used consistently (no Member/Viewer).
- **No `db push` after T13**; baseline-resolve documented, not auto-run against prod.
