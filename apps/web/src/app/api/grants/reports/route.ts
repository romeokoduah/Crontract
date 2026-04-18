import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createReportSchema = z.object({
  grantId: z.string().uuid(),
  period: z.string().min(1),
  type: z.enum(["NARRATIVE", "FINANCIAL", "COMBINED"]),
  dueDate: z.string(),
  content: z.any().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "ACCEPTED", "REVISION_REQUESTED"]).default("DRAFT"),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const reports = await prisma.grantReport.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
      },
      include: {
        grant: { select: { title: true, grantNumber: true } },
      },
      orderBy: { dueDate: "desc" },
    })

    return NextResponse.json({ reports })
  } catch (err) {
    console.error("[GET /api/grants/reports]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createReportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    // Generate report number
    const count = await prisma.grantReport.count({ where: { workspaceId } })
    const reportNumber = `RPT-${String(count + 1).padStart(4, "0")}`

    const report = await prisma.grantReport.create({
      data: {
        workspaceId,
        grantId: data.grantId,
        reportNumber,
        period: data.period,
        type: data.type,
        status: data.status,
        dueDate: new Date(data.dueDate),
        content: data.content,
        createdBy: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "grant_report",
        entityId: report.id,
        action: "CREATE",
        afterState: { reportNumber: report.reportNumber, type: report.type, status: report.status },
      },
    })

    return NextResponse.json({ report }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/grants/reports]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
