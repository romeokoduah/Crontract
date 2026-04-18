import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  amount: z.number().nonnegative(),
})

const createPOSchema = z.object({
  vendorId: z.string().uuid(),
  title: z.string().min(1),
  issueDate: z.string(),
  deliveryDate: z.string().optional(),
  lines: z.array(lineSchema).min(1),
  tax: z.number().nonnegative().default(0),
  currency: z.string().default("GHS"),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
        ...(status ? { status: status as "DRAFT" | "SUBMITTED" | "APPROVED" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "BILLED" | "CANCELLED" } : {}),
      },
      include: {
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ orders })
  } catch (err) {
    console.error("[GET /api/procurement/orders]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createPOSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const vendor = await prisma.vendor.findFirst({ where: { id: data.vendorId, workspaceId, deletedAt: null } })
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 })

    const subtotal = data.lines.reduce((sum, l) => sum + l.amount, 0)
    const total = subtotal + data.tax

    const count = await prisma.purchaseOrder.count({ where: { workspaceId } })
    const number = `PO-${String(count + 1).padStart(4, "0")}`

    const order = await prisma.purchaseOrder.create({
      data: {
        workspaceId,
        number,
        vendorId: data.vendorId,
        title: data.title,
        issueDate: new Date(data.issueDate),
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        lines: data.lines,
        subtotal,
        tax: data.tax,
        total,
        currency: data.currency,
        notes: data.notes,
        createdBy: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "purchase_order",
        entityId: order.id,
        action: "CREATE",
        afterState: { number: order.number, vendorId: order.vendorId, status: order.status, total: order.total },
      },
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/procurement/orders]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
