import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    // Fetch all roles for workspace with their permissions (optimized single query)
    const [roles, allPermissions] = await Promise.all([
      prisma.role.findMany({
        where: { workspaceId: session.user.workspaceId },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      }),
      prisma.permission.findMany({
        orderBy: [{ module: "asc" }, { entity: "asc" }, { action: "asc" }],
      }),
    ])

    // Group permissions by module for matrix view
    const permissionsByModule = allPermissions.reduce<Record<string, typeof allPermissions>>(
      (acc, p) => {
        if (!acc[p.module]) acc[p.module] = []
        acc[p.module].push(p)
        return acc
      },
      {}
    )

    // Build role permission sets for fast lookup
    const rolesWithPermissionSets = roles.map((r) => ({
      ...r,
      permissionIds: new Set(r.permissions.map((rp) => rp.permissionId)),
      permissions: undefined, // strip to save payload size
    }))

    return NextResponse.json({ roles: rolesWithPermissionSets, permissions: allPermissions, permissionsByModule })
  } catch (err) {
    console.error("[GET /api/admin/roles]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
