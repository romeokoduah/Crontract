import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const receiptLineSchema = z.object({
  description: z.string(),
  quantityOrdered: z.number(),
  quantityReceived: z.number(),
})

const patchSchema = z.object({
  action: z.enum(["submit", "approve", "send", "receive", "cancel"]),
  // For receive action
  receivedDate: z.string().optional(),
  receiptLines: z.array(receiptLineSchema).optional(),
  receiptNotes: z.string().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const order = await prisma.purchaseOrder.findFirst({
      where: { id: params.id, workspaceId: session.user.workspaceId },
      include: {
        vendor: true,
        goodsReceipts: { orderBy: { createdAt: "desc" } },
        bills: { include: { vendor: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      },
    })

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    return NextResponse.json({ order })
  } catch (err) {
    console.error("[GET /api/procurement/orders/[id]]", err)
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

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const { action, receivedDate, receiptLines, receiptNotes } = parsed.data
    const workspaceId = session.user.workspaceId
    const userId = session.user.id

    const order = await prisma.purchaseOrder.findFirst({ where: { id: params.id, workspaceId } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const statusMap: Record<string, string> = {
      submit: "SUBMITTED",
      approve: "APPROVED",
      send: "SENT",
      receive: "RECEIVED",
      cancel: "CANCELLED",
    }

    const validTransitions: Record<string, string[]> = {
      submit: ["DRAFT"],
      approve: ["SUBMITTED"],
      send: ["APPROVED"],
      receive: ["SENT", "PARTIALLY_RECEIVED"],
      cancel: ["DRAFT", "SUBMITTED", "APPROVED"],
    }

    if (!validTransitions[action]?.includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot ${action} a ${order.status} order` },
        { status: 422 }
      )
    }

    const newStatus = statusMap[action] as "DRAFT" | "SUBMITTED" | "APPROVED" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "BILLED" | "CANCELLED"

    const updated = await prisma.purchaseOrder.update({
      where: { id: params.id },
      data: { status: newStatus },
    })

    // Create goods receipt record when receiving
    if (action === "receive" && receiptLines) {
      const count = await prisma.goodsReceipt.count({ where: { workspaceId } })
      const receiptNumber = `GR-${String(count + 1).padStart(4, "0")}`

      await prisma.goodsReceipt.create({
        data: {
          workspaceId,
          purchaseOrderId: params.id,
          number: receiptNumber,
          receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
          receivedBy: userId,
          lines: receiptLines,
          notes: receiptNotes,
        },
      })
    }

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "purchase_order",
        entityId: params.id,
        action: action.toUpperCase(),
        beforeState: { status: order.status },
        afterState: { status: newStatus },
      },
    })

    return NextResponse.json({ order: updated })
  } catch (err) {
    console.error("[PATCH /api/procurement/orders/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
