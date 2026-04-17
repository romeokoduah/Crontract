import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const patchBudgetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "ACTIVE", "CLOSED"]).optional(),
  lines: z
    .array(
      z.object({
        category: z.string(),
        description: z.string().optional(),
        budgetAmount: z.number().min(0),
        actualAmount: z.number().min(0).default(0),
        committedAmount: z.number().min(0).default(0),
        phasing: z.record(z.string(), z.number()).optional(),
      })
    )
    .optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const budget = await prisma.budget.findFirst({
      where: { id: params.id, workspaceId: session.user.workspaceId },
    })
    if (!budget) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const creator = await prisma.user.findUnique({
      where: { id: budget.createdBy },
      select: { id: true, name: true },
    })

    return NextResponse.json({ budget: { ...budget, creator } })
  } catch (err) {
    console.error("[GET /api/budget/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const existing = await prisma.budget.findFirst({
      where: { id: params.id, workspaceId: session.user.workspaceId },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await req.json()
    const parsed = patchBudgetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const { workspaceId, id: userId } = session.user
    const data = parsed.data

    const totalAmount = data.lines
      ? data.lines.reduce((sum, l) => sum + l.budgetAmount, 0)
      : Number(existing.totalAmount)

    const budget = await prisma.budget.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.lines !== undefined ? { lines: data.lines, totalAmount } : {}),
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "budget",
        entityId: budget.id,
        action: "UPDATE",
        beforeState: { status: existing.status },
        afterState: { status: budget.status, totalAmount: budget.totalAmount.toString() },
      },
    })

    return NextResponse.json({ budget })
  } catch (err) {
    console.error("[PATCH /api/budget/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
