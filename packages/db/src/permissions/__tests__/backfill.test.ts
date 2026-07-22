import { describe, it, expect, vi } from "vitest"
import { backfillRoleGrants } from "../backfill"

// Fake prisma that models the real rolePermission unique constraint
// (@@unique([roleId, permissionId])) via a Map, so upsert genuinely
// updates-in-place instead of duplicating — letting us test real idempotency.
function fakePrisma() {
  const store = new Map<string, any>()
  return {
    _store: store,
    get _rolePerms() { return [...store.values()] },
    role: { findMany: vi.fn(async () => [{ id: "r1", name: "Employee" }]) },
    permission: { findMany: vi.fn(async () =>
      // minimal: the two codes the assertions below touch
      [
        { id: "p1", code: "payroll:payslip:view_own" },
        { id: "p2", code: "payroll:run:view" },
      ]) },
    rolePermission: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = `${where.roleId_permissionId.roleId}:${where.roleId_permissionId.permissionId}`
        const existing = store.get(key)
        const row = existing ? { ...existing, ...update } : create
        store.set(key, row)
        return row
      }),
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

  it("is idempotent — a second run does not duplicate grants", async () => {
    const p = fakePrisma()
    await backfillRoleGrants(p, "w1")
    const first = p._rolePerms.length
    expect(first).toBeGreaterThan(0)
    await backfillRoleGrants(p, "w1")
    // Real unique-constraint semantics: re-running updates in place, count unchanged.
    expect(p._rolePerms.length).toBe(first)
  })

  it("re-run updates an existing grant's scope in place (upsert update path)", async () => {
    const p = fakePrisma()
    await backfillRoleGrants(p, "w1")
    // Simulate a prior grant stored with a different scope, then re-backfill.
    const key = "r1:p1"
    p._store.set(key, { ...p._store.get(key), scope: "ALL" })
    await backfillRoleGrants(p, "w1")
    expect(p._store.get(key).scope).toBe("OWN") // restored to the default-grant scope
  })
})
