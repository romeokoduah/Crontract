import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { isAdmin, requireAuth } from "@/lib/authorization"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const authDenied = requireAuth(session)
    if (authDenied) return authDenied

    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get("status") // PENDING | APPROVED | REJECTED | CANCELLED
    const view = searchParams.get("view") // "mine" or "all"

    const userId = session!.user.id
    const workspaceId = session!.user.workspaceId!
    const admin = isAdmin(session)

    // Get all approvals for this workspace
    const approvals = await prisma.approval.findMany({
      where: {
        workspaceId,
        ...(statusFilter ? { status: statusFilter as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" } : {}),
        ...(!admin ? { requestedBy: userId } : {}),
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
