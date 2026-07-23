import { prisma } from "@/lib/db"
import type { PermissionScope } from "./scopes"
import { widerScope } from "./scopes"

export type Grant = { code: string; scope: PermissionScope }

type CacheEntry = { grants: Map<string, PermissionScope>; expires: number }
const cache = new Map<string, CacheEntry>()
const TTL_MS = 60_000

export function invalidateRoleGrants(roleId: string): void {
  cache.delete(roleId)
}

export async function loadRoleGrants(roleId: string): Promise<Map<string, PermissionScope>> {
  // Fail closed on a missing/empty roleId. Without this, Prisma drops an
  // `undefined` filter and `findMany({ where: { roleId: undefined } })` returns
  // EVERY RolePermission row (all roles, all workspaces) — which would grant the
  // caller every permission. A session can legitimately lack roleId (e.g. a JWT
  // minted before roleId was added to the token), so this must deny, not query.
  if (!roleId) return new Map()

  const now = Date.now()
  const hit = cache.get(roleId)
  if (hit && hit.expires > now) return hit.grants

  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { scope: true, permission: { select: { code: true } } },
  })

  const grants = new Map<string, PermissionScope>()
  for (const r of rows) {
    const scope = r.scope as PermissionScope
    const existing = grants.get(r.permission.code)
    grants.set(r.permission.code, existing ? widerScope(existing, scope) : scope)
  }
  cache.set(roleId, { grants, expires: now + TTL_MS })
  return grants
}
