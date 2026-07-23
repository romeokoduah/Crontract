import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { isAdmin, requireAuth } from "@/lib/authorization"
import { requirePermission } from "@/lib/authz/guard"
import { invalidateRoleGrants } from "@/lib/authz/grants"
import type { PermissionScope } from "@/lib/authz/scopes"

const putSchema = z.object({
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

/**
 * Replaces a role's permission grants and invalidates the cached grants for
 * that role so the change takes effect on the next `can()` check (rather
 * than waiting out the loader's TTL).
 */
export async function applyRolePermissions(
  prisma: any,
  roleId: string,
  entries: { permissionId: string; scope: PermissionScope }[],
) {
  await prisma.rolePermission.deleteMany({ where: { roleId } })
  if (entries.length) {
    await prisma.rolePermission.createMany({
      data: entries.map((e) => ({ roleId, permissionId: e.permissionId, scope: e.scope })),
      skipDuplicates: true,
    })
  }
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
