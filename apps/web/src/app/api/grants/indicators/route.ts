import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createIndicatorSchema = z.object({
  grantId: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(["OUTPUT", "OUTCOME", "IMPACT"]),
  unit: z.string().min(1),
  baseline: z.number().default(0),
  target: z.number(),
  collectionFrequency: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]).default("QUARTERLY"),
  category: z.string().optional(),
  dataSource: z.string().optional(),
  responsible: z.string().optional(),
})

const createResultSchema = z.object({
  indicatorId: z.string().uuid(),
  period: z.string().min(1),
  actualValue: z.number(),
  notes: z.string().optional(),
  evidenceKey: z.string().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const indicators = await prisma.indicator.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
      },
      include: {
        grant: { select: { title: true, grantNumber: true } },
        results: { orderBy: { reportedDate: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ indicators })
  } catch (err) {
    console.error("[GET /api/grants/indicators]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    // Two modes: create indicator result or create indicator
    if (body.indicatorId) {
      const parsed = createResultSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
          { status: 400 }
        )
      }

      const data = parsed.data

      const result = await prisma.indicatorResult.create({
        data: {
          workspaceId,
          indicatorId: data.indicatorId,
          period: data.period,
          actualValue: data.actualValue,
          notes: data.notes,
          evidenceKey: data.evidenceKey,
          reportedBy: userId,
          reportedDate: new Date(),
        },
      })

      await prisma.auditLog.create({
        data: {
          workspaceId,
          userId,
          entityType: "indicator_result",
          entityId: result.id,
          action: "CREATE",
          afterState: { indicatorId: result.indicatorId, period: result.period, actualValue: Number(result.actualValue) },
        },
      })

      return NextResponse.json({ result }, { status: 201 })
    } else {
      const parsed = createIndicatorSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
          { status: 400 }
        )
      }

      const data = parsed.data

      const indicator = await prisma.indicator.create({
        data: {
          workspaceId,
          grantId: data.grantId,
          name: data.name,
          type: data.type,
          unit: data.unit,
          baseline: data.baseline,
          target: data.target,
          collectionFrequency: data.collectionFrequency,
          category: data.category,
          dataSource: data.dataSource,
          responsible: data.responsible,
        },
      })

      await prisma.auditLog.create({
        data: {
          workspaceId,
          userId,
          entityType: "indicator",
          entityId: indicator.id,
          action: "CREATE",
          afterState: { name: indicator.name, type: indicator.type, target: Number(indicator.target) },
        },
      })

      return NextResponse.json({ indicator }, { status: 201 })
    }
  } catch (err) {
    console.error("[POST /api/grants/indicators]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
