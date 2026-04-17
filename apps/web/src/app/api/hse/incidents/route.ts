import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const createIncidentSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1),
  incidentDate: z.string(),
  location: z.string().min(1),
  severity: z.enum(["NEAR_MISS", "MINOR", "MODERATE", "MAJOR", "FATAL"]),
  type: z.enum(["INJURY", "PROPERTY_DAMAGE", "ENVIRONMENTAL", "NEAR_MISS", "VEHICLE", "FIRE", "CHEMICAL", "ELECTRICAL", "OTHER"]),
  injuredPersons: z.array(z.object({
    name: z.string(),
    injuryType: z.string(),
    severity: z.string(),
  })).optional().default([]),
  witnesses: z.array(z.string()).optional().default([]),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const severity = searchParams.get("severity")
    const status = searchParams.get("status")
    const type = searchParams.get("type")

    const incidents = await prisma.incident.findMany({
      where: {
        workspaceId: session.user.workspaceId,
        ...(severity ? { severity: severity as "NEAR_MISS" | "MINOR" | "MODERATE" | "MAJOR" | "FATAL" } : {}),
        ...(status ? { status: status as "REPORTED" | "UNDER_INVESTIGATION" | "CORRECTIVE_ACTIONS" | "CLOSED" | "REOPENED" } : {}),
        ...(type ? { type: type as "INJURY" | "PROPERTY_DAMAGE" | "ENVIRONMENTAL" | "NEAR_MISS" | "VEHICLE" | "FIRE" | "CHEMICAL" | "ELECTRICAL" | "OTHER" } : {}),
      },
      orderBy: { createdAt: "desc" },
    })

    // Enrich with reporter names
    const userIds = [...new Set(incidents.map((i) => i.reportedBy).filter(Boolean))]
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : []
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    const enriched = incidents.map((i) => ({
      ...i,
      reportedByUser: userMap[i.reportedBy] ?? null,
    }))

    return NextResponse.json({ incidents: enriched })
  } catch (err) {
    console.error("[GET /api/hse/incidents]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = createIncidentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session.user.workspaceId
    const userId = session.user.id

    // Generate incident number
    const count = await prisma.incident.count({ where: { workspaceId } })
    const number = `INC-${String(count + 1).padStart(4, "0")}`

    const incident = await prisma.incident.create({
      data: {
        workspaceId,
        number,
        title: parsed.data.title,
        description: parsed.data.description,
        incidentDate: new Date(parsed.data.incidentDate),
        location: parsed.data.location,
        severity: parsed.data.severity,
        type: parsed.data.type,
        reportedBy: userId,
        injuredPersons: parsed.data.injuredPersons,
        witnesses: parsed.data.witnesses,
        status: "REPORTED",
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "incident",
        entityId: incident.id,
        action: "CREATE",
        afterState: { number: incident.number, title: incident.title, severity: incident.severity },
      },
    })

    return NextResponse.json({ incident }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/hse/incidents]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
