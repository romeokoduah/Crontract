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
