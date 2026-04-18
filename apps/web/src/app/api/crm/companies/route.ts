import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  industry: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  size: z.enum(["SMALL", "MEDIUM", "LARGE", "ENTERPRISE"]).optional(),
  annualRevenue: z.number().nonnegative().optional(),
  notes: z.string().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const companies = await prisma.crmCompany.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
        deletedAt: null,
      },
      include: {
        _count: {
          select: { contacts: true, deals: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ companies })
  } catch (err) {
    console.error("[GET /api/crm/companies]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createCompanySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const company = await prisma.crmCompany.create({
      data: {
        workspaceId,
        name: data.name,
        industry: data.industry,
        website: data.website,
        phone: data.phone,
        email: data.email || null,
        address: data.address,
        size: data.size,
        annualRevenue: data.annualRevenue,
        notes: data.notes,
        ownerId: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "crm_company",
        entityId: company.id,
        action: "CREATE",
        afterState: { name: company.name, industry: company.industry },
      },
    })

    return NextResponse.json({ company }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/crm/companies]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
