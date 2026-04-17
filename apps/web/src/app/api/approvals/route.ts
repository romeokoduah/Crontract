import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get("status") // PENDING | APPROVED | REJECTED | CANCELLED
    const view = searchParams.get("view") // "mine" or "all"

    const userId = session.user.id
    const workspaceId = session.user.workspaceId

    // Get all approvals for this workspace
    const approvals = await prisma.approval.findMany({
      where: {
        workspaceId,
        ...(statusFilter ? { status: statusFilter as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" } : {}),
      },
      include: {
        flow: { select: { id: true, name: true, entityType: true, steps: true } },
        decisions: { orderBy: { step: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    })

    // Filter to "mine" - approvals where the user is a decision-maker at current step
    const filtered =
      view === "mine"
        ? approvals.filter((a) => {
            if (a.status !== "PENDING") return false
            const steps = (a.flow.steps as { approverIds?: string[] }[]) ?? []
            const step = steps[a.currentStep]
            return step?.approverIds?.includes(userId) ?? false
          })
        : approvals

    // Enrich with requestedBy user
    const userIds = [...new Set(filtered.map((a) => a.requestedBy))]
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : []
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    const enriched = filtered.map((a) => ({
      ...a,
      requestedByUser: userMap[a.requestedBy] ?? null,
    }))

    return NextResponse.json({ approvals: enriched })
  } catch (err) {
    console.error("[GET /api/approvals]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
