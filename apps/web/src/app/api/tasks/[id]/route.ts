import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.number().nullable().optional(),
  actualHours: z.number().nullable().optional(),
  labels: z.array(z.string()).optional(),
  position: z.number().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }
    if (!session.user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 403 })
    }

    const existing = await prisma.task.findFirst({
      where: { id: params.id, workspaceId: session.user.workspaceId, deletedAt: null },
    })
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const body = await req.json()
    const parsed = updateTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const task = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
        ...(data.estimatedHours !== undefined && { estimatedHours: data.estimatedHours ?? undefined }),
        ...(data.actualHours !== undefined && { actualHours: data.actualHours ?? undefined }),
        ...(data.labels !== undefined && { labels: data.labels }),
        ...(data.position !== undefined && { position: data.position }),
      },
      include: {
        subtasks: { where: { deletedAt: null }, orderBy: { position: "asc" } },
      },
    })

    if (data.status && data.status !== existing.status) {
      await prisma.auditLog.create({
        data: {
          workspaceId: session.user.workspaceId,
          userId: session.user.id,
          entityType: "task",
          entityId: task.id,
          action: "UPDATE",
          beforeState: { status: existing.status },
          afterState: { status: task.status },
        },
      })
    }

    // Enrich with assignee
    const assignee = task.assigneeId
      ? await prisma.user.findUnique({
          where: { id: task.assigneeId },
          select: { id: true, name: true, avatarUrl: true },
        })
      : null

    return NextResponse.json({ task: { ...task, assignee } })
  } catch (err) {
    console.error("[PATCH /api/tasks/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }
    if (!session.user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 403 })
    }

    const existing = await prisma.task.findFirst({
      where: { id: params.id, workspaceId: session.user.workspaceId, deletedAt: null },
    })
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    await prisma.task.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId: session.user.workspaceId,
        userId: session.user.id,
        entityType: "task",
        entityId: params.id,
        action: "DELETE",
        beforeState: { title: existing.title },
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/tasks/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
