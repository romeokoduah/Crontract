import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { isAdmin, requireAuth } from "@/lib/authorization"

const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.number().optional(),
  labels: z.array(z.string()).default([]),
  position: z.number().default(0),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const authDenied = requireAuth(session)
    if (authDenied) return authDenied

    const workspaceId = session!.user.workspaceId!
    const admin = isAdmin(session)

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get("projectId")
    const status = searchParams.get("status")

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 })
    }

    // Verify project belongs to workspace
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
    })
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        workspaceId,
        deletedAt: null,
        parentId: null, // top-level only unless specified
        ...(status ? { status: status as "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED" } : {}),
        ...(!admin ? { assigneeId: session!.user.id } : {}),
      },
      include: {
        subtasks: {
          where: { deletedAt: null },
          orderBy: { position: "asc" },
        },
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    })

    // Enrich with assignee info
    const assigneeIds = tasks
      .map((t) => t.assigneeId)
      .filter((id): id is string => id !== null)
    const assignees = assigneeIds.length
      ? await prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true, avatarUrl: true },
        })
      : []
    const assigneeMap = Object.fromEntries(assignees.map((u) => [u.id, u]))

    const enriched = tasks.map((t) => ({
      ...t,
      assignee: t.assigneeId ? (assigneeMap[t.assigneeId] ?? null) : null,
    }))

    return NextResponse.json({ tasks: enriched })
  } catch (err) {
    console.error("[GET /api/tasks]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const authDenied = requireAuth(session)
    if (authDenied) return authDenied

    const body = await req.json()
    const parsed = createTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    // Verify project belongs to workspace
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, workspaceId, deletedAt: null },
    })
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Get max position for the status column
    const maxPositionTask = await prisma.task.findFirst({
      where: { projectId: data.projectId, status: data.status, deletedAt: null, parentId: null },
      orderBy: { position: "desc" },
      select: { position: true },
    })
    const position = (maxPositionTask?.position ?? -1) + 1

    const task = await prisma.task.create({
      data: {
        workspaceId,
        projectId: data.projectId,
        parentId: data.parentId,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        assigneeId: data.assigneeId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        estimatedHours: data.estimatedHours ?? undefined,
        labels: data.labels,
        position,
        createdBy: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "task",
        entityId: task.id,
        action: "CREATE",
        afterState: { title: task.title, status: task.status, projectId: task.projectId },
      },
    })

    return NextResponse.json({ task }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/tasks]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
