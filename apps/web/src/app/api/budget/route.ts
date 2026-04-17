import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const budgetLineSchema = z.object({
  category: z.string().min(1),
  description: z.string().optional(),
  budgetAmount: z.number().min(0),
  actualAmount: z.number().min(0).default(0),
  committedAmount: z.number().min(0).default(0),
  phasing: z.record(z.string(), z.number()).optional(), // { "Jan": 5000, "Feb": 3000, ... }
})

const createBudgetSchema = z.object({
  name: z.string().min(1).max(200),
  year: z.number().int().min(2020).max(2050),
  lines: z.array(budgetLineSchema).min(1),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "ACTIVE", "CLOSED"]).default("DRAFT"),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const year = searchParams.get("year")

    const budgets = await prisma.budget.findMany({
      where: {
        workspaceId: session.user.workspaceId,
        ...(status ? { status: status as "DRAFT" | "SUBMITTED" | "APPROVED" | "ACTIVE" | "CLOSED" } : {}),
        ...(year ? { year: parseInt(year) } : {}),
      },
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    })

    // Enrich with creator names
    const userIds = [...new Set(budgets.map((b) => b.createdBy))]
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : []
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    const enriched = budgets.map((b) => ({
      ...b,
      createdByUser: userMap[b.createdBy] ?? null,
    }))

    return NextResponse.json({ budgets: enriched })
  } catch (err) {
    console.error("[GET /api/budget]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = createBudgetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const { workspaceId, id: userId } = session.user
    const { name, year, lines, status } = parsed.data

    const totalAmount = lines.reduce((sum, l) => sum + l.budgetAmount, 0)

    const budget = await prisma.budget.create({
      data: {
        workspaceId,
        name,
        year,
        lines,
        status,
        totalAmount,
        createdBy: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "budget",
        entityId: budget.id,
        action: "CREATE",
        afterState: { name: budget.name, year: budget.year, totalAmount: budget.totalAmount.toString() },
      },
    })

    return NextResponse.json({ budget }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/budget]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
