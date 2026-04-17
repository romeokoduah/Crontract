import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const createExpenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("GHS"),
  category: z.string().min(1),
  date: z.string(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const expenses = await prisma.expense.findMany({
      where: {
        workspaceId: session.user.workspaceId,
        ...(status ? { status: status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REIMBURSED" } : {}),
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ expenses })
  } catch (err) {
    console.error("[GET /api/finance/expenses]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = createExpenseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session.user.workspaceId
    const userId = session.user.id

    const expense = await prisma.expense.create({
      data: {
        workspaceId,
        description: data.description,
        amount: data.amount,
        currency: data.currency,
        category: data.category,
        date: new Date(data.date),
        status: "DRAFT",
        submittedBy: userId,
        notes: data.notes,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "expense",
        entityId: expense.id,
        action: "CREATE",
        afterState: { description: expense.description, amount: expense.amount, status: expense.status },
      },
    })

    return NextResponse.json({ expense }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/finance/expenses]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
