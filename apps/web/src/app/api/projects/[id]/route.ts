import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  budget: z.number().nullable().optional(),
  ownerId: z.string().uuid().optional(),
})

export async function GET(
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

    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        workspaceId: session.user.workspaceId,
        deletedAt: null,
      },
      include: {
        tasks: {
          where: { deletedAt: null, parentId: null },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const owner = await prisma.user.findUnique({
      where: { id: project.ownerId },
      select: { id: true, name: true, avatarUrl: true },
    })

    return NextResponse.json({ project: { ...project, owner } })
  } catch (err) {
    console.error("[GET /api/projects/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    const existing = await prisma.project.findFirst({
      where: { id: params.id, workspaceId: session.user.workspaceId, deletedAt: null },
    })
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const body = await req.json()
    const parsed = updateProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
        ...(data.budget !== undefined && { budget: data.budget ?? undefined }),
        ...(data.ownerId !== undefined && { ownerId: data.ownerId }),
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId: session.user.workspaceId,
        userId: session.user.id,
        entityType: "project",
        entityId: project.id,
        action: "UPDATE",
        beforeState: { status: existing.status },
        afterState: { status: project.status },
      },
    })

    return NextResponse.json({ project })
  } catch (err) {
    console.error("[PATCH /api/projects/[id]]", err)
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

    const existing = await prisma.project.findFirst({
      where: { id: params.id, workspaceId: session.user.workspaceId, deletedAt: null },
    })
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    await prisma.project.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId: session.user.workspaceId,
        userId: session.user.id,
        entityType: "project",
        entityId: params.id,
        action: "DELETE",
        beforeState: { name: existing.name },
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/projects/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
