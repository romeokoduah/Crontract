import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createDealSchema = z.object({
  title: z.string().min(1, "Deal title is required"),
  value: z.number().positive("Deal value must be positive"),
  currency: z.string().default("GHS"),
  stage: z.enum(["QUALIFIED", "PROPOSAL", "NEGOTIATION", "CONTRACT_SENT", "WON", "LOST"]).default("QUALIFIED"),
  probability: z.number().min(0).max(100).default(0),
  contactId: z.string().uuid().optional().or(z.literal("")),
  companyId: z.string().uuid().optional().or(z.literal("")),
  expectedCloseDate: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const deals = await prisma.crmDeal.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
        deletedAt: null,
      },
      include: {
        contact: { select: { firstName: true, lastName: true } },
        company: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ deals })
  } catch (err) {
    console.error("[GET /api/crm/deals]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createDealSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    // Generate deal number
    const count = await prisma.crmDeal.count({ where: { workspaceId } })
    const number = `DEAL-${String(count + 1).padStart(4, "0")}`

    const deal = await prisma.crmDeal.create({
      data: {
        workspaceId,
        number,
        title: data.title,
        value: data.value,
        currency: data.currency,
        stage: data.stage,
        probability: data.probability,
        contactId: data.contactId || null,
        companyId: data.companyId || null,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        notes: data.notes,
        ownerId: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "crm_deal",
        entityId: deal.id,
        action: "CREATE",
        afterState: { number: deal.number, title: deal.title, value: Number(deal.value), stage: deal.stage },
      },
    })

    return NextResponse.json({ deal }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/crm/deals]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
