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

const createInvoiceSchema = z.object({
  customerName: z.string().min(1),
  issueDate: z.string(),
  dueDate: z.string(),
  currency: z.string().default("GHS"),
  lines: z.array(lineSchema).min(1),
  tax: z.number().nonnegative().default(0),
  notes: z.string().optional(),
  status: z.enum(["DRAFT", "SENT"]).default("DRAFT"),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const invoices = await prisma.invoice.findMany({
      where: {
        workspaceId: session.user.workspaceId,
        ...(status ? { status: status as "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" } : {}),
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ invoices })
  } catch (err) {
    console.error("[GET /api/finance/invoices]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = createInvoiceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session.user.workspaceId
    const userId = session.user.id

    const subtotal = data.lines.reduce((sum, l) => sum + l.amount, 0)
    const total = subtotal + data.tax

    // Generate invoice number
    const count = await prisma.invoice.count({ where: { workspaceId } })
    const number = `INV-${String(count + 1).padStart(4, "0")}`

    const invoice = await prisma.invoice.create({
      data: {
        workspaceId,
        number,
        customerName: data.customerName,
        issueDate: new Date(data.issueDate),
        dueDate: new Date(data.dueDate),
        currency: data.currency,
        status: data.status,
        subtotal,
        tax: data.tax,
        total,
        notes: data.notes,
        lines: data.lines,
        createdBy: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "invoice",
        entityId: invoice.id,
        action: "CREATE",
        afterState: { number: invoice.number, status: invoice.status, total: invoice.total },
      },
    })

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/finance/invoices]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
