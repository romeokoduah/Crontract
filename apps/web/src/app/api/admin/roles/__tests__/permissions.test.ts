import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/authz/grants", () => ({ invalidateRoleGrants: vi.fn() }))

import { applyRolePermissions, putSchema } from "../[id]/permissions/route"
import { invalidateRoleGrants } from "@/lib/authz/grants"

describe("putSchema", () => {
  it("rejects an empty body so it cannot silently wipe a role's grants", () => {
    expect(putSchema.safeParse({}).success).toBe(false)
  })
  it("accepts an explicit empty permissionIds array (clear all)", () => {
    expect(putSchema.safeParse({ permissionIds: [] }).success).toBe(true)
  })
  it("accepts the scoped shape", () => {
    const r = putSchema.safeParse({ permissions: [{ permissionId: "550e8400-e29b-41d4-a716-446655440000", scope: "TEAM" }] })
    expect(r.success).toBe(true)
  })
})

// Fake that models `$transaction([...])` so the delete+create are applied
// atomically as a batch — mirroring the real Prisma client's array form.
function fakeDb() {
  const calls: string[] = []
  const rolePermission = {
    deleteMany: vi.fn((args: unknown) => ({ op: "deleteMany", args })),
    createMany: vi.fn((args: unknown) => ({ op: "createMany", args })),
  }
  return {
    _calls: calls,
    rolePermission,
    $transaction: vi.fn(async (ops: any[]) => {
      for (const op of ops) calls.push(op.op)
      return ops
    }),
  } as any
}

describe("applyRolePermissions", () => {
  it("writes delete + create atomically in one $transaction and persists scope", async () => {
    const db = fakeDb()
    await applyRolePermissions(db, "r1", [{ permissionId: "p1", scope: "TEAM" }])

    // Single atomic batch, delete before create.
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(db._calls).toEqual(["deleteMany", "createMany"])
    expect(db.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: "r1" } })
    expect(db.rolePermission.createMany).toHaveBeenCalledWith({
      data: [{ roleId: "r1", permissionId: "p1", scope: "TEAM" }],
      skipDuplicates: true,
    })
    expect(invalidateRoleGrants).toHaveBeenCalledWith("r1")
  })

  it("clears all grants (delete only) when entries is empty, still atomic + invalidates", async () => {
    const db = fakeDb()
    await applyRolePermissions(db, "r2", [])

    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(db._calls).toEqual(["deleteMany"])
    expect(db.rolePermission.createMany).not.toHaveBeenCalled()
    expect(invalidateRoleGrants).toHaveBeenCalledWith("r2")
  })

  it("does NOT invalidate the cache if the transaction throws (no partial wipe surfaced)", async () => {
    const db = fakeDb()
    db.$transaction = vi.fn(async () => {
      throw new Error("db down")
    })
    await expect(applyRolePermissions(db, "r3", [{ permissionId: "p1", scope: "ALL" }])).rejects.toThrow("db down")
    expect(invalidateRoleGrants).not.toHaveBeenCalledWith("r3")
  })
})
