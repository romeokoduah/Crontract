import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const patchSchema = z.object({
  roleId: z.string().uuid(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session!.user.workspaceId!) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const membership = await prisma.membership.findFirst({
      where: { id: params.id, workspaceId: session!.user.workspaceId! },
    })
    if (!membership) return NextResponse.json({ error: "Member not found" }, { status: 404 })

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    // Verify role belongs to workspace
    const role = await prisma.role.findFirst({ where: { id: parsed.data.roleId, workspaceId: session!.user.workspaceId! } })
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })

    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const updated = await prisma.membership.update({
      where: { id: params.id },
      data: { roleId: parsed.data.roleId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        role: { select: { id: true, name: true } },
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "membership",
        entityId: membership.id,
        action: "CHANGE_ROLE",
        beforeState: { roleId: membership.roleId },
        afterState: { roleId: parsed.data.roleId },
      },
    })

    return NextResponse.json({ membership: updated })
  } catch (err) {
    console.error("[PATCH /api/admin/members/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session!.user.workspaceId!) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const membership = await prisma.membership.findFirst({
      where: { id: params.id, workspaceId: session!.user.workspaceId! },
    })
    if (!membership) return NextResponse.json({ error: "Member not found" }, { status: 404 })

    // Prevent removing workspace owner
    if (membership.isOwner) {
      return NextResponse.json({ error: "Cannot remove workspace owner" }, { status: 403 })
    }

    // Prevent self-removal via this endpoint
    if (membership.userId === session!.user.id) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 403 })
    }

    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    await prisma.membership.delete({ where: { id: params.id } })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "membership",
        entityId: membership.id,
        action: "REMOVE_MEMBER",
        beforeState: { userId: membership.userId, roleId: membership.roleId },
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/admin/members/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
