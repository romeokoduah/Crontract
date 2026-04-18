import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  companyId: z.string().uuid().optional().or(z.literal("")),
  lifecycleStage: z.enum(["LEAD", "PROSPECT", "OPPORTUNITY", "CUSTOMER", "CHURNED"]).default("LEAD"),
  source: z.enum(["WEB", "REFERRAL", "EVENT", "COLD_CALL", "SOCIAL", "OTHER"]).optional(),
  notes: z.string().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const contacts = await prisma.crmContact.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
        deletedAt: null,
      },
      include: {
        company: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ contacts })
  } catch (err) {
    console.error("[GET /api/crm/contacts]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createContactSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const contact = await prisma.crmContact.create({
      data: {
        workspaceId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone,
        jobTitle: data.jobTitle,
        companyId: data.companyId || null,
        lifecycleStage: data.lifecycleStage,
        source: data.source,
        notes: data.notes,
        ownerId: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "crm_contact",
        entityId: contact.id,
        action: "CREATE",
        afterState: { firstName: contact.firstName, lastName: contact.lastName, lifecycleStage: contact.lifecycleStage },
      },
    })

    return NextResponse.json({ contact }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/crm/contacts]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
