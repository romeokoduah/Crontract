import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createAuditSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["INTERNAL", "EXTERNAL", "REGULATORY"]),
  scheduledDate: z.string(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("PLANNED"),
  auditor: z.string().optional(),
  scope: z.string().optional(),
  findings: z.any().optional(),
  overallRating: z.enum(["SATISFACTORY", "NEEDS_IMPROVEMENT", "UNSATISFACTORY"]).optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const audits = await prisma.complianceAudit.findMany({
      where: { workspaceId: session!.user.workspaceId! },
      include: {
        _count: { select: { correctiveActions: true } },
      },
      orderBy: { scheduledDate: "desc" },
    })

    return NextResponse.json({ audits })
  } catch (err) {
    console.error("[GET /api/compliance/audits]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createAuditSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    // Auto-generate audit number
    const count = await prisma.complianceAudit.count({ where: { workspaceId } })
    const auditNumber = `AUD-${String(count + 1).padStart(4, "0")}`

    const audit = await prisma.complianceAudit.create({
      data: {
        workspaceId,
        auditNumber,
        title: data.title,
        type: data.type,
        scheduledDate: new Date(data.scheduledDate),
        status: data.status,
        auditor: data.auditor,
        scope: data.scope,
        findings: data.findings,
        overallRating: data.overallRating,
        createdBy: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "compliance_audit",
        entityId: audit.id,
        action: "CREATE",
        afterState: { auditNumber: audit.auditNumber, title: audit.title, status: audit.status },
      },
    })

    return NextResponse.json({ audit }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/compliance/audits]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
