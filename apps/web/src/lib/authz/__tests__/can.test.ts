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
