import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/authz/grants", () => ({ invalidateRoleGrants: vi.fn() }))

import { applyRolePermissions } from "../[id]/permissions/route"
import { invalidateRoleGrants } from "@/lib/authz/grants"

describe("applyRolePermissions", () => {
  it("invalidates the role cache after applying", async () => {
    const prisma = {
      rolePermission: { deleteMany: vi.fn(async () => {}), createMany: vi.fn(async () => {}) },
    } as any

    await applyRolePermissions(prisma, "r1", [{ permissionId: "p1", scope: "TEAM" }])

    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: "r1" } })
    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
      data: [{ roleId: "r1", permissionId: "p1", scope: "TEAM" }],
      skipDuplicates: true,
    })
    expect(invalidateRoleGrants).toHaveBeenCalledWith("r1")
  })

  it("skips createMany when there are no entries but still invalidates", async () => {
    const prisma = {
      rolePermission: { deleteMany: vi.fn(async () => {}), createMany: vi.fn(async () => {}) },
    } as any

    await applyRolePermissions(prisma, "r2", [])

    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: "r2" } })
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled()
    expect(invalidateRoleGrants).toHaveBeenCalledWith("r2")
  })
})
