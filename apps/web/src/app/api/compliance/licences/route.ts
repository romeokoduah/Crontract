import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createLicenceSchema = z.object({
  name: z.string().min(1),
  issuingAuthority: z.string().min(1),
  licenceNumber: z.string().min(1),
  category: z.string().optional(),
  issueDate: z.string(),
  expiryDate: z.string(),
  renewalCost: z.number().nonnegative().optional(),
  currency: z.string().default("GHS"),
  alertDaysBefore: z.number().int().positive().default(30),
  responsibleId: z.string().uuid().optional(),
  notes: z.string().optional(),
  documentKey: z.string().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const workspaceId = session!.user.workspaceId!
    const now = new Date()

    // Auto-update expired licences
    await prisma.licence.updateMany({
      where: {
        workspaceId,
        deletedAt: null,
        status: { in: ["ACTIVE", "EXPIRING_SOON"] },
        expiryDate: { lt: now },
      },
      data: { status: "EXPIRED" },
    })

    // Auto-update expiring soon licences
    const licencesForAlert = await prisma.licence.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        status: "ACTIVE",
        expiryDate: { gte: now },
      },
    })

    for (const licence of licencesForAlert) {
      const alertDate = new Date(now.getTime() + licence.alertDaysBefore * 24 * 60 * 60 * 1000)
      if (licence.expiryDate <= alertDate) {
        await prisma.licence.update({
          where: { id: licence.id },
          data: { status: "EXPIRING_SOON" },
        })
      }
    }

    const licences = await prisma.licence.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      orderBy: { expiryDate: "asc" },
    })

    return NextResponse.json({ licences })
  } catch (err) {
    console.error("[GET /api/compliance/licences]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createLicenceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const licence = await prisma.licence.create({
      data: {
        workspaceId,
        name: data.name,
        issuingAuthority: data.issuingAuthority,
        licenceNumber: data.licenceNumber,
        category: data.category,
        issueDate: new Date(data.issueDate),
        expiryDate: new Date(data.expiryDate),
        renewalCost: data.renewalCost,
        currency: data.currency,
        alertDaysBefore: data.alertDaysBefore,
        responsibleId: data.responsibleId,
        notes: data.notes,
        documentKey: data.documentKey,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "licence",
        entityId: licence.id,
        action: "CREATE",
        afterState: { name: licence.name, licenceNumber: licence.licenceNumber, status: licence.status },
      },
    })

    return NextResponse.json({ licence }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/compliance/licences]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
