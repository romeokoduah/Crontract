import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "./auth"

// ─── Role Constants ─────────────────────────────────────────────────────────
// Centralized — never use string literals for role checks elsewhere.

export const ADMIN_ROLES = ["Owner", "Administrator"] as const

// ─── Helpers ────────────────────────────────────────────────────────────────

export type SessionUser = {
  id: string
  email: string
  name: string
  workspaceId?: string
  workspaceName?: string
  role?: string
  mustChangePassword?: boolean
}

/** Session user after requireAuth / requireAdminRole has passed. */
export type AuthedUser = SessionUser & { workspaceId: string }

export function isAdmin(session: { user: SessionUser } | null): boolean {
  if (!session?.user?.role) return false
  return ADMIN_ROLES.includes(session.user.role as (typeof ADMIN_ROLES)[number])
}

// ─── API Guards ─────────────────────────────────────────────────────────────
// Return NextResponse on failure, null on success. Caller pattern:
//   const denied = requireAdmin(session); if (denied) return denied;

export function requireAuth(
  session: { user: SessionUser } | null
): NextResponse | null {
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }
  if (!session.user.workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 })
  }
  return null
}

export function requireAdminRole(
  session: { user: SessionUser } | null
): NextResponse | null {
  const authCheck = requireAuth(session)
  if (authCheck) return authCheck

  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

// ─── Convenience: get session + guard in one call ───────────────────────────

export async function getAuthedSession() {
  const session = await getServerSession(authOptions)
  return session
}

export async function getAdminSession() {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session)
  return { session, denied }
}
