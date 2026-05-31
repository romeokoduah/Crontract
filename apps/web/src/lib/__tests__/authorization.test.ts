import { describe, it, expect } from "vitest"
import { isAdmin, requireAuth, requireAdminRole } from "../authorization"
import type { SessionUser } from "../authorization"

function session(user: Partial<SessionUser> | null): { user: SessionUser } | null {
  if (!user) return null
  return {
    user: {
      id: user.id ?? "u1",
      email: user.email ?? "u@test.io",
      name: user.name ?? "User",
      workspaceId: user.workspaceId,
      role: user.role,
    },
  }
}

describe("isAdmin", () => {
  it("is true for Owner and Administrator", () => {
    expect(isAdmin(session({ role: "Owner" }))).toBe(true)
    expect(isAdmin(session({ role: "Administrator" }))).toBe(true)
  })

  it("is false for non-admin roles, missing role, and null session", () => {
    expect(isAdmin(session({ role: "Manager" }))).toBe(false)
    expect(isAdmin(session({ role: "Employee" }))).toBe(false)
    expect(isAdmin(session({}))).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })

  it("does not treat an arbitrary string as admin (no injection via role)", () => {
    expect(isAdmin(session({ role: "owner" }))).toBe(false) // case-sensitive
    expect(isAdmin(session({ role: "Admin" }))).toBe(false)
  })
})

describe("requireAuth", () => {
  it("returns null (allow) for an authenticated user with a workspace", () => {
    expect(requireAuth(session({ id: "u1", workspaceId: "ws1" }))).toBeNull()
  })

  it("returns 401 when there is no session/user", async () => {
    const res = requireAuth(null)
    expect(res?.status).toBe(401)
  })

  it("returns 403 when the user has no workspace", () => {
    const res = requireAuth(session({ id: "u1" }))
    expect(res?.status).toBe(403)
  })
})

describe("requireAdminRole", () => {
  it("returns null (allow) for an admin with a workspace", () => {
    expect(
      requireAdminRole(session({ id: "u1", workspaceId: "ws1", role: "Owner" }))
    ).toBeNull()
  })

  it("returns 401 before checking role when unauthenticated", () => {
    expect(requireAdminRole(null)?.status).toBe(401)
  })

  it("returns 403 for a non-admin with a workspace", () => {
    const res = requireAdminRole(
      session({ id: "u1", workspaceId: "ws1", role: "Manager" })
    )
    expect(res?.status).toBe(403)
  })

  it("returns 403 (no workspace) before the role check", () => {
    const res = requireAdminRole(session({ id: "u1", role: "Owner" }))
    expect(res?.status).toBe(403)
  })
})
