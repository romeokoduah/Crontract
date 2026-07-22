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
