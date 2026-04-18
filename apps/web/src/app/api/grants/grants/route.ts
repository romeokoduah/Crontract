import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const lineSchema = z.object({
  category: z.string().min(1),
  amount: z.number().nonnegative(),
})

const createGrantSchema = z.object({
  donorId: z.string().uuid(),
  title: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("GHS"),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(["PIPELINE", "SUBMITTED", "APPROVED", "ACTIVE", "SUSPENDED", "CLOSEOUT", "CLOSED"]).default("PIPELINE"),
  reportingFrequency: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]).default("QUARTERLY"),
  description: z.string().optional(),
  programArea: z.string().optional(),
  contactPerson: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const grants = await prisma.grant.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
        deletedAt: null,
        ...(status ? { status: status as "PIPELINE" | "SUBMITTED" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "CLOSEOUT" | "CLOSED" } : {}),
      },
      include: {
        donor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ grants })
  } catch (err) {
    console.error("[GET /api/grants/grants]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createGrantSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    // Generate grant number
    const count = await prisma.grant.count({ where: { workspaceId } })
    const grantNumber = `GRT-${String(count + 1).padStart(4, "0")}`

    const grant = await prisma.grant.create({
      data: {
        workspaceId,
        donorId: data.donorId,
        grantNumber,
        title: data.title,
        description: data.description,
        amount: data.amount,
        currency: data.currency,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: data.status,
        reportingFrequency: data.reportingFrequency,
        programArea: data.programArea,
        contactPerson: data.contactPerson,
        notes: data.notes,
        lines: data.lines ?? [],
        createdBy: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "grant",
        entityId: grant.id,
        action: "CREATE",
        afterState: { grantNumber: grant.grantNumber, title: grant.title, amount: Number(grant.amount), status: grant.status },
      },
    })

    return NextResponse.json({ grant }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/grants/grants]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
