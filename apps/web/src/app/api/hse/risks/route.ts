import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const createRiskSchema = z.object({
  title: z.string().min(1).max(500),
  area: z.string().min(1),
  assessedDate: z.string(),
  hazards: z.array(z.object({ description: z.string(), likelihood: z.number(), consequence: z.number() })).default([]),
  controls: z.array(z.string()).default([]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  reviewDate: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const riskLevel = searchParams.get("riskLevel")
    const status = searchParams.get("status")

    const risks = await prisma.riskAssessment.findMany({
      where: {
        workspaceId: session.user.workspaceId,
        ...(riskLevel ? { riskLevel } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ risks })
  } catch (err) {
    console.error("[GET /api/hse/risks]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = createRiskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session.user.workspaceId
    const userId = session.user.id

    const risk = await prisma.riskAssessment.create({
      data: {
        workspaceId,
        title: parsed.data.title,
        area: parsed.data.area,
        assessedBy: userId,
        assessedDate: new Date(parsed.data.assessedDate),
        hazards: parsed.data.hazards,
        controls: parsed.data.controls,
        riskLevel: parsed.data.riskLevel,
        status: "ACTIVE",
        reviewDate: parsed.data.reviewDate ? new Date(parsed.data.reviewDate) : undefined,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "risk_assessment",
        entityId: risk.id,
        action: "CREATE",
        afterState: { title: risk.title, riskLevel: risk.riskLevel },
      },
    })

    return NextResponse.json({ risk }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/hse/risks]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
