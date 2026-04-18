import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createObligationSchema = z.object({
  title: z.string().min(1),
  regulation: z.string().optional(),
  category: z.enum(["REGULATORY", "CONTRACTUAL", "INTERNAL", "INDUSTRY"]),
  description: z.string().optional(),
  frequency: z.enum(["ONE_TIME", "DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"]).default("ANNUAL"),
  status: z.enum(["COMPLIANT", "NON_COMPLIANT", "AT_RISK", "NOT_ASSESSED"]).default("NOT_ASSESSED"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  ownerId: z.string().uuid().optional(),
  nextDueDate: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const obligations = await prisma.complianceObligation.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
        deletedAt: null,
      },
      orderBy: { nextDueDate: { sort: "asc", nulls: "last" } },
    })

    return NextResponse.json({ obligations })
  } catch (err) {
    console.error("[GET /api/compliance/obligations]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createObligationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const obligation = await prisma.complianceObligation.create({
      data: {
        workspaceId,
        title: data.title,
        regulation: data.regulation,
        category: data.category,
        description: data.description,
        frequency: data.frequency,
        status: data.status,
        priority: data.priority,
        ownerId: data.ownerId,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : undefined,
        notes: data.notes,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "compliance_obligation",
        entityId: obligation.id,
        action: "CREATE",
        afterState: { title: obligation.title, category: obligation.category, status: obligation.status },
      },
    })

    return NextResponse.json({ obligation }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/compliance/obligations]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
