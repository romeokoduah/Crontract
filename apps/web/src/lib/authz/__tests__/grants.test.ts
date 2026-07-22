import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { widerScope } from "../scopes"

vi.mock("@/lib/db", () => ({
  prisma: { rolePermission: { findMany: vi.fn() } },
}))

import { loadRoleGrants, invalidateRoleGrants } from "../grants"
import { prisma } from "@/lib/db"

const findMany = prisma.rolePermission.findMany as unknown as ReturnType<typeof vi.fn>

function rows(...pairs: [string, string][]) {
  return pairs.map(([code, scope]) => ({ scope, permission: { code } }))
}

beforeEach(() => {
  vi.clearAllMocks()
  // Distinct roleId per test avoids cross-test cache bleed in the module-level Map.
})

describe("widerScope", () => {
  it("ranks ALL > TEAM > OWN for every pairing", () => {
    expect(widerScope("ALL", "TEAM")).toBe("ALL")
    expect(widerScope("TEAM", "ALL")).toBe("ALL")
    expect(widerScope("TEAM", "OWN")).toBe("TEAM")
    expect(widerScope("OWN", "TEAM")).toBe("TEAM")
    expect(widerScope("ALL", "OWN")).toBe("ALL")
    expect(widerScope("OWN", "OWN")).toBe("OWN")
  })
})

describe("loadRoleGrants", () => {
  it("collapses duplicate codes to the widest scope", async () => {
    findMany.mockResolvedValue(
      rows(["projects:task:update", "OWN"], ["projects:task:update", "ALL"])
    )
    const grants = await loadRoleGrants("role-widest")
    expect(grants.get("projects:task:update")).toBe("ALL")
  })

  it("caches within the TTL — a second call does not hit the DB", async () => {
    findMany.mockResolvedValue(rows(["a:b:view", "ALL"]))
    await loadRoleGrants("role-cache")
    await loadRoleGrants("role-cache")
    expect(findMany).toHaveBeenCalledTimes(1)
  })

  it("invalidateRoleGrants forces the next call to reload from the DB", async () => {
    findMany.mockResolvedValue(rows(["a:b:view", "ALL"]))
    await loadRoleGrants("role-invalidate")
    invalidateRoleGrants("role-invalidate")
    await loadRoleGrants("role-invalidate")
    expect(findMany).toHaveBeenCalledTimes(2)
  })

  describe("with fake timers", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("reloads after the 60s TTL expires", async () => {
      findMany.mockResolvedValue(rows(["a:b:view", "ALL"]))
      await loadRoleGrants("role-ttl")
      vi.advanceTimersByTime(60_001)
      await loadRoleGrants("role-ttl")
      expect(findMany).toHaveBeenCalledTimes(2)
    })
  })
})
