import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const inviteSchema = z.object({
  email: z.string().email(),
  roleId: z.string().uuid(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const memberships = await prisma.membership.findMany({
      where: { workspaceId: session.user.workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true } },
        role: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ members: memberships })
  } catch (err) {
    console.error("[GET /api/admin/members]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = inviteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session.user.workspaceId
    const userId = session.user.id

    // Verify role belongs to workspace
    const role = await prisma.role.findFirst({ where: { id: parsed.data.roleId, workspaceId } })
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })

    // Check for existing pending invitation
    const existing = await prisma.invitation.findFirst({
      where: { email: parsed.data.email, workspaceId, status: "PENDING" },
    })
    if (existing) return NextResponse.json({ error: "Invitation already sent to this email" }, { status: 409 })

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    const invitation = await prisma.invitation.create({
      data: {
        email: parsed.data.email,
        workspaceId,
        roleId: parsed.data.roleId,
        invitedBy: userId,
        expiresAt,
        status: "PENDING",
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "invitation",
        entityId: invitation.id,
        action: "INVITE",
        afterState: { email: parsed.data.email, roleId: parsed.data.roleId },
      },
    })

    return NextResponse.json({ invitation }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/admin/members]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
