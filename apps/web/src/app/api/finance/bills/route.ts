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

const createBillSchema = z.object({
  vendorId: z.string().uuid(),
  issueDate: z.string(),
  dueDate: z.string(),
  currency: z.string().default("GHS"),
  lines: z.array(lineSchema).min(1),
  tax: z.number().nonnegative().default(0),
  poId: z.string().uuid().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const bills = await prisma.bill.findMany({
      where: {
        workspaceId: session.user.workspaceId,
        ...(status ? { status: status as "DRAFT" | "RECEIVED" | "APPROVED" | "PAID" | "CANCELLED" } : {}),
      },
      include: {
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ bills })
  } catch (err) {
    console.error("[GET /api/finance/bills]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = createBillSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session.user.workspaceId
    const userId = session.user.id

    // Verify vendor belongs to workspace
    const vendor = await prisma.vendor.findFirst({ where: { id: data.vendorId, workspaceId, deletedAt: null } })
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 })

    const subtotal = data.lines.reduce((sum, l) => sum + l.amount, 0)
    const total = subtotal + data.tax

    const count = await prisma.bill.count({ where: { workspaceId } })
    const number = `BILL-${String(count + 1).padStart(4, "0")}`

    const bill = await prisma.bill.create({
      data: {
        workspaceId,
        number,
        vendorId: data.vendorId,
        issueDate: new Date(data.issueDate),
        dueDate: new Date(data.dueDate),
        currency: data.currency,
        status: "DRAFT",
        subtotal,
        tax: data.tax,
        total,
        poId: data.poId,
        notes: data.notes,
        lines: data.lines,
        createdBy: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "bill",
        entityId: bill.id,
        action: "CREATE",
        afterState: { number: bill.number, status: bill.status, total: bill.total },
      },
    })

    return NextResponse.json({ bill }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/finance/bills]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
