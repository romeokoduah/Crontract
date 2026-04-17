import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  amount: z.number().nonnegative(),
})

const createPRSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  neededBy: z.string().optional(),
  lines: z.array(lineSchema).min(1),
  currency: z.string().default("GHS"),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const requisitions = await prisma.purchaseRequisition.findMany({
      where: {
        workspaceId: session.user.workspaceId,
        ...(status ? { status: status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CONVERTED" | "CANCELLED" } : {}),
      },
      orderBy: { createdAt: "desc" },
    })

    // Enrich with requester names
    const userIds = Array.from(new Set(requisitions.map((r) => r.requestedBy)))
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : []
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))

    const enriched = requisitions.map((r) => ({
      ...r,
      requesterName: userMap[r.requestedBy] ?? "Unknown",
    }))

    return NextResponse.json({ requisitions: enriched })
  } catch (err) {
    console.error("[GET /api/procurement/requisitions]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = createPRSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session.user.workspaceId
    const userId = session.user.id

    const totalAmount = data.lines.reduce((sum, l) => sum + l.amount, 0)
    const count = await prisma.purchaseRequisition.count({ where: { workspaceId } })
    const number = `PR-${String(count + 1).padStart(4, "0")}`

    const requisition = await prisma.purchaseRequisition.create({
      data: {
        workspaceId,
        number,
        title: data.title,
        description: data.description,
        priority: data.priority,
        neededBy: data.neededBy ? new Date(data.neededBy) : null,
        lines: data.lines,
        totalAmount,
        currency: data.currency,
        requestedBy: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "purchase_requisition",
        entityId: requisition.id,
        action: "CREATE",
        afterState: { number: requisition.number, title: requisition.title, status: requisition.status },
      },
    })

    return NextResponse.json({ requisition }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/procurement/requisitions]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
