import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { isAdmin, requireAuth } from "@/lib/authorization"
import { requirePermission, scopeWhere } from "@/lib/authz/guard"
import { loadRoleGrants } from "@/lib/authz/grants"
import { AUTHZ_ENFORCED } from "@/lib/env"

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
    const authDenied = requireAuth(session)
    if (authDenied) return authDenied

    const denied = await requirePermission(
      { id: session!.user.id, roleId: session!.user.roleId! },
      "crm:deal:view",
      undefined,
      () => isAdmin(session),
    )
    if (denied) return denied

    const scoped = AUTHZ_ENFORCED
      ? scopeWhere(
          { id: session!.user.id },
          (await loadRoleGrants(session!.user.roleId!)).get("crm:deal:view") ?? "OWN",
          { ownerFields: ["ownerId"] },
        )
      : {}

    const deals = await prisma.crmDeal.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
        deletedAt: null,
        ...scoped,
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
    const authDenied = requireAuth(session)
    if (authDenied) return authDenied

    const denied = await requirePermission(
      { id: session!.user.id, roleId: session!.user.roleId! },
      "crm:deal:manage",
      undefined,
      () => isAdmin(session),
    )
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

    // Verify any referenced records belong to this workspace (no cross-tenant FK association).
    if (data.contactId) {
      const contact = await prisma.crmContact.findFirst({ where: { id: data.contactId, workspaceId }, select: { id: true } })
      if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 400 })
    }
    if (data.companyId) {
      const company = await prisma.crmCompany.findFirst({ where: { id: data.companyId, workspaceId }, select: { id: true } })
      if (!company) return NextResponse.json({ error: "Company not found" }, { status: 400 })
    }

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
