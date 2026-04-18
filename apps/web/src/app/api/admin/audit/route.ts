import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session!.user.workspaceId!) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")
    const entityType = searchParams.get("entityType")
    const action = searchParams.get("action")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const page = parseInt(searchParams.get("page") ?? "1", 10)
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") ?? "50", 10), 200)

    const where = {
      workspaceId: session!.user.workspaceId!,
      ...(userId ? { userId } : {}),
      ...(entityType ? { entityType } : {}),
      ...(action ? { action } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (err) {
    console.error("[GET /api/admin/audit]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
