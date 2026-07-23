import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { isAdmin, requireAuth } from "@/lib/authorization"
import { requirePermission, scopeWhere } from "@/lib/authz/guard"
import { loadRoleGrants } from "@/lib/authz/grants"
import { AUTHZ_ENFORCED } from "@/lib/env"

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).default("PLANNING"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().optional(),
  ownerId: z.string().uuid().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const authDenied = requireAuth(session)
    if (authDenied) return authDenied

    const workspaceId = session!.user.workspaceId!

    const denied = await requirePermission(
      { id: session!.user.id, roleId: session!.user.roleId! },
      "projects:project:view",
    )
    if (denied) return denied

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    let scoping: Record<string, unknown>
    if (AUTHZ_ENFORCED) {
      const grants = await loadRoleGrants(session!.user.roleId!)
      const viewScope = grants.get("projects:project:view") ?? "OWN"
      scoping =
        viewScope === "ALL"
          ? {}
          : viewScope === "TEAM"
            ? { OR: [{ ownerId: session!.user.id }, { members: { some: { userId: session!.user.id } } }] }
            : scopeWhere({ id: session!.user.id }, "OWN", { ownerFields: ["ownerId"] })
    } else {
      scoping = isAdmin(session) ? {} : { ownerId: session!.user.id }
    }

    const projects = await prisma.project.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(status ? { status: status as "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED" } : {}),
        ...scoping,
      },
      include: {
        _count: { select: { tasks: { where: { deletedAt: null } } } },
        tasks: {
          where: { deletedAt: null },
          select: { id: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Enrich with owner info from users table
    const ownerIds = Array.from(new Set(projects.map((p) => p.ownerId)))
    const owners = await prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, name: true, avatarUrl: true },
    })
    const ownerMap = Object.fromEntries(owners.map((u) => [u.id, u]))

    const enriched = projects.map((p) => ({
      ...p,
      owner: ownerMap[p.ownerId] ?? null,
      taskCount: p._count.tasks,
      completedTaskCount: p.tasks.filter((t) => t.status === "DONE").length,
    }))

    return NextResponse.json({ projects: enriched })
  } catch (err) {
    console.error("[GET /api/projects]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const authDenied = requireAuth(session)
    if (authDenied) return authDenied

    const denied = await requirePermission(
      { id: session!.user.id, roleId: session!.user.roleId! },
      "projects:project:create",
      undefined,
      () => isAdmin(session),
    )
    if (denied) return denied

    const body = await req.json()
    const parsed = createProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          workspaceId,
          name: data.name,
          description: data.description,
          status: data.status,
          priority: data.priority,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          budget: data.budget ?? undefined,
          ownerId: data.ownerId ?? userId,
          createdBy: userId,
        },
      })

      await tx.projectMember.create({
        data: { projectId: created.id, userId: created.ownerId, role: "LEAD" },
      })

      return created
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "project",
        entityId: project.id,
        action: "CREATE",
        afterState: { name: project.name, status: project.status },
      },
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/projects]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
