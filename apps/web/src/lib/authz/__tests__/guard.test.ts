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

  // Shadow mode's whole purpose: when disabled it must STILL evaluate can()
  // and log the would-be denial, so the go-live plan can find enforcement gaps.
  // A regression that short-circuits before can() would silently break this.
  it("shadow mode still calls can() and logs the would-be denial", async () => {
    flag.AUTHZ_ENFORCED = false
    ;(can as any).mockResolvedValue(false)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await requirePermission(USER, "projects:task:update")
    expect(can).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it("shadow mode does not log when can() would allow", async () => {
    flag.AUTHZ_ENFORCED = false
    ;(can as any).mockResolvedValue(true)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await requirePermission(USER, "projects:task:update")
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
