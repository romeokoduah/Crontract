import { NextResponse } from "next/server"
import { AUTHZ_ENFORCED } from "@/lib/env"
import { can, type ResourceCtx } from "./can"
import type { PermissionScope } from "./scopes"

export async function requirePermission(
  user: { id: string; roleId: string },
  code: string,
  resource?: ResourceCtx,
  legacy?: () => boolean | Promise<boolean>,
): Promise<NextResponse | null> {
  const would = await can(user, code, resource)
  if (AUTHZ_ENFORCED) {
    return would ? null : NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!would) console.warn(`[authz:shadow-deny] user=${user.id} code=${code}`)
  if (legacy) {
    const ok = await legacy()
    return ok ? null : NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

/** Prisma `where` fragment restricting a list query to the caller's scope. */
export function scopeWhere(
  user: { id: string },
  scope: PermissionScope,
  fields: { projectPath?: string; ownerFields?: string[] },
): Record<string, unknown> {
  if (scope === "ALL") return {}
  if (scope === "TEAM" && fields.projectPath) {
    return { [fields.projectPath]: { members: { some: { userId: user.id } } } }
  }
  const owners = fields.ownerFields ?? ["createdBy"]
  return { OR: owners.map((f) => ({ [f]: user.id })) }
}
