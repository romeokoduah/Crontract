import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const putSchema = z.object({
  permissionIds: z.array(z.string().uuid()),
})

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const role = await prisma.role.findFirst({
      where: { id: params.id, workspaceId: session.user.workspaceId },
    })
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })

    const body = await req.json()
    const parsed = putSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session.user.workspaceId
    const userId = session.user.id

    // Get existing permissions for audit diff
    const existing = await prisma.rolePermission.findMany({ where: { roleId: params.id } })
    const existingIds = existing.map((rp) => rp.permissionId)

    // Replace all permissions in a transaction
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: params.id } }),
      ...(parsed.data.permissionIds.length > 0
        ? [
            prisma.rolePermission.createMany({
              data: parsed.data.permissionIds.map((permissionId) => ({
                roleId: params.id,
                permissionId,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ])

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "role",
        entityId: role.id,
        action: "UPDATE_PERMISSIONS",
        beforeState: { permissionIds: existingIds },
        afterState: { permissionIds: parsed.data.permissionIds },
      },
    })

    return NextResponse.json({ success: true, permissionCount: parsed.data.permissionIds.length })
  } catch (err) {
    console.error("[PUT /api/admin/roles/[id]/permissions]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
