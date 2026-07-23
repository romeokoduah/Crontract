import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import type { PrismaClient } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { isAdmin, requireAuth } from "@/lib/authorization"
import { requirePermission } from "@/lib/authz/guard"
import { invalidateRoleGrants } from "@/lib/authz/grants"
import type { PermissionScope } from "@/lib/authz/scopes"

export const putSchema = z
  .object({
    permissions: z
      .array(
        z.object({
          permissionId: z.string().uuid(),
          scope: z.enum(["ALL", "TEAM", "OWN"]).default("ALL"),
        })
      )
      .optional(),
    // legacy shape: plain ids default to ALL scope
    permissionIds: z.array(z.string().uuid()).optional(),
  })
  // Require the caller to state its intent explicitly. Without this, a body of
  // `{}` (or one missing both keys) would parse and silently strip the role of
  // every permission. To clear all grants, send an explicit empty array.
  .refine((b) => b.permissions !== undefined || b.permissionIds !== undefined, {
    message: "Provide `permissions` or `permissionIds` (use [] to clear all)",
  })

/**
 * Minimal prisma surface `applyRolePermissions` needs — derived from the real
 * client so the concrete `prisma` satisfies it, without widening to `any`.
 */
type RolePermissionWriter = Pick<PrismaClient, "$transaction" | "rolePermission">

/**
 * Replaces a role's permission grants atomically and invalidates the cached
 * grants for that role so the change takes effect on the next `can()` check
 * (rather than waiting out the loader's TTL). The delete+create run in one
 * transaction so a failure can never leave the role with zero permissions.
 */
export async function applyRolePermissions(
  db: RolePermissionWriter,
  roleId: string,
  entries: { permissionId: string; scope: PermissionScope }[],
) {
  await db.$transaction([
    db.rolePermission.deleteMany({ where: { roleId } }),
    ...(entries.length
      ? [
          db.rolePermission.createMany({
            data: entries.map((e) => ({ roleId, permissionId: e.permissionId, scope: e.scope })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ])
  invalidateRoleGrants(roleId)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const authDenied = requireAuth(session)
    if (authDenied) return authDenied

    const denied = await requirePermission(
      { id: session!.user.id, roleId: session!.user.roleId! },
      "admin:role:manage", undefined, () => isAdmin(session),
    )
    if (denied) return denied

    const role = await prisma.role.findFirst({
      where: { id: params.id, workspaceId: session!.user.workspaceId! },
    })
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })

    const body = await req.json()
    const parsed = putSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    // Normalise to scoped entries; legacy bare-id clients default to ALL scope.
    const entries: { permissionId: string; scope: PermissionScope }[] = parsed.data.permissions
      ? parsed.data.permissions
      : (parsed.data.permissionIds ?? []).map((permissionId) => ({ permissionId, scope: "ALL" as const }))

    // Get existing permissions for audit diff
    const existing = await prisma.rolePermission.findMany({ where: { roleId: params.id } })
    const existingIds = existing.map((rp) => rp.permissionId)

    await applyRolePermissions(prisma, params.id, entries)

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "role",
        entityId: role.id,
        action: "UPDATE_PERMISSIONS",
        beforeState: { permissionIds: existingIds },
        afterState: { permissionIds: entries.map((e) => e.permissionId) },
      },
    })

    return NextResponse.json({ success: true, permissionCount: entries.length })
  } catch (err) {
    console.error("[PUT /api/admin/roles/[id]/permissions]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
