import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createActionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "OVERDUE", "CANCELLED"]).default("OPEN"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  auditId: z.string().uuid().optional(),
  obligationId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const actions = await prisma.correctiveAction.findMany({
      where: { workspaceId: session!.user.workspaceId! },
      include: {
        audit: { select: { title: true, auditNumber: true } },
        obligation: { select: { title: true } },
      },
      orderBy: { dueDate: "asc" },
    })

    return NextResponse.json({ actions })
  } catch (err) {
    console.error("[GET /api/compliance/actions]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const action = await prisma.correctiveAction.create({
      data: {
        workspaceId,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        auditId: data.auditId,
        obligationId: data.obligationId,
        assigneeId: data.assigneeId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        createdBy: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "corrective_action",
        entityId: action.id,
        action: "CREATE",
        afterState: { title: action.title, status: action.status, priority: action.priority },
      },
    })

    return NextResponse.json({ action }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/compliance/actions]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
