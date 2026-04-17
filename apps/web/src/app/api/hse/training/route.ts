import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const createTrainingSchema = z.object({
  employeeId: z.string().uuid(),
  trainingType: z.string().min(1),
  provider: z.string().optional(),
  completedDate: z.string(),
  expiryDate: z.string().optional(),
  certificateKey: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const expiryFilter = searchParams.get("expiry") // "expired" | "expiring_soon" | "all"

    const now = new Date()
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const trainings = await prisma.safetyTraining.findMany({
      where: {
        workspaceId: session.user.workspaceId,
        ...(expiryFilter === "expired"
          ? { expiryDate: { lt: now } }
          : expiryFilter === "expiring_soon"
          ? { expiryDate: { gte: now, lte: thirtyDaysOut } }
          : {}),
      },
      orderBy: { completedDate: "desc" },
    })

    // Enrich with employee info
    const employeeIds = [...new Set(trainings.map((t) => t.employeeId))]
    const employees = employeeIds.length
      ? await prisma.employee.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, firstName: true, lastName: true, jobTitle: true },
        })
      : []
    const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]))

    const enriched = trainings.map((t) => ({
      ...t,
      employee: employeeMap[t.employeeId] ?? null,
      isExpired: t.expiryDate ? t.expiryDate < now : false,
      isExpiringSoon: t.expiryDate ? t.expiryDate >= now && t.expiryDate <= thirtyDaysOut : false,
    }))

    return NextResponse.json({ trainings: enriched })
  } catch (err) {
    console.error("[GET /api/hse/training]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = createTrainingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session.user.workspaceId
    const userId = session.user.id

    const training = await prisma.safetyTraining.create({
      data: {
        workspaceId,
        employeeId: parsed.data.employeeId,
        trainingType: parsed.data.trainingType,
        provider: parsed.data.provider,
        completedDate: new Date(parsed.data.completedDate),
        expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : undefined,
        certificateKey: parsed.data.certificateKey,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "safety_training",
        entityId: training.id,
        action: "CREATE",
        afterState: { trainingType: training.trainingType, employeeId: training.employeeId },
      },
    })

    return NextResponse.json({ training }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/hse/training]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
