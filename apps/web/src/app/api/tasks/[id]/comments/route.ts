import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requirePermission } from "@/lib/authz/guard"

const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  parentId: z.string().uuid().optional(),
})

/** Resource context for a task's comments — scoped like the task itself. */
function taskCommentCtx(task: { projectId: string; assigneeId: string | null; createdBy: string }) {
  return {
    projectId: task.projectId,
    ownerIds: [task.assigneeId, task.createdBy].filter(Boolean) as string[],
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }
    if (!session!.user.workspaceId!) {
      return NextResponse.json({ error: "No workspace" }, { status: 403 })
    }

    // Verify task belongs to workspace
    const task = await prisma.task.findFirst({
      where: { id: params.id, workspaceId: session!.user.workspaceId!, deletedAt: null },
    })
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const denied = await requirePermission(
      { id: session!.user.id, roleId: session!.user.roleId! },
      "projects:task:view",
      taskCommentCtx(task),
    )
    if (denied) return denied

    const comments = await prisma.comment.findMany({
      where: {
        entityType: "task",
        entityId: params.id,
        workspaceId: session!.user.workspaceId!,
        deletedAt: null,
        parentId: null,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        replies: {
          where: { deletedAt: null },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ comments })
  } catch (err) {
    console.error("[GET /api/tasks/[id]/comments]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }
    if (!session!.user.workspaceId!) {
      return NextResponse.json({ error: "No workspace" }, { status: 403 })
    }

    const task = await prisma.task.findFirst({
      where: { id: params.id, workspaceId: session!.user.workspaceId!, deletedAt: null },
    })
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const denied = await requirePermission(
      { id: session!.user.id, roleId: session!.user.roleId! },
      "projects:task:view",
      taskCommentCtx(task),
    )
    if (denied) return denied

    const body = await req.json()
    const parsed = createCommentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const comment = await prisma.comment.create({
      data: {
        workspaceId: session!.user.workspaceId!,
        entityType: "task",
        entityId: params.id,
        userId: session!.user.id,
        content: parsed.data.content,
        parentId: parsed.data.parentId,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    return NextResponse.json({ comment }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/tasks/[id]/comments]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
