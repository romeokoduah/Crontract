import { NextResponse } from "next/server"
import { AUTHZ_ENFORCED } from "@/lib/env"
import { can, type ResourceCtx } from "./can"
import type { PermissionScope } from "./scopes"

export async function requirePermission(
  user: { id: string; roleId: string },
  code: string,
  resource?: ResourceCtx,
): Promise<NextResponse | null> {
  const allowed = await can(user, code, resource)
  if (allowed) return null
  if (!AUTHZ_ENFORCED) {
    console.warn(`[authz:shadow-deny] user=${user.id} code=${code}`)
    return null
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
