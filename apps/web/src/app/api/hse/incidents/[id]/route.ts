import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { isAdmin, requireAuth, requireAdminRole } from "@/lib/authorization"

const patchSchema = z.object({
  status: z.enum(["REPORTED", "UNDER_INVESTIGATION", "CORRECTIVE_ACTIONS", "CLOSED", "REOPENED"]).optional(),
  investigator: z.string().uuid().optional().nullable(),
  rootCause: z.string().optional().nullable(),
  correctiveActions: z.array(z.object({
    id: z.string(),
    description: z.string(),
    responsiblePerson: z.string(),
    dueDate: z.string(),
    status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED"]),
  })).optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const authDenied = requireAuth(session)
    if (authDenied) return authDenied

    const admin = isAdmin(session)

    const incident = await prisma.incident.findFirst({
      where: { id: params.id, workspaceId: session!.user.workspaceId! },
    })
    if (!incident) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (!admin && incident.reportedBy !== session!.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Enrich with user info
    const userIds = [incident.reportedBy, incident.investigator].filter((id): id is string => !!id)
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : []
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    return NextResponse.json({
      incident: {
        ...incident,
        reportedByUser: userMap[incident.reportedBy] ?? null,
        investigatorUser: incident.investigator ? (userMap[incident.investigator] ?? null) : null,
      },
    })
  } catch (err) {
    console.error("[GET /api/hse/incidents/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const existing = await prisma.incident.findFirst({
      where: { id: params.id, workspaceId: session!.user.workspaceId! },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const incident = await prisma.incident.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.investigator !== undefined ? { investigator: parsed.data.investigator } : {}),
        ...(parsed.data.rootCause !== undefined ? { rootCause: parsed.data.rootCause } : {}),
        ...(parsed.data.correctiveActions !== undefined ? { correctiveActions: parsed.data.correctiveActions } : {}),
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "incident",
        entityId: incident.id,
        action: "UPDATE",
        beforeState: { status: existing.status },
        afterState: { status: incident.status, ...parsed.data },
      },
    })

    return NextResponse.json({ incident })
  } catch (err) {
    console.error("[PATCH /api/hse/incidents/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
