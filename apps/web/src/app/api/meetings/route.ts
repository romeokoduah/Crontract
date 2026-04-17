import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const createMeetingSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  location: z.string().optional(),
  projectId: z.string().uuid().optional(),
  attendees: z.array(z.string()).default([]),
  agenda: z
    .array(
      z.object({
        topic: z.string(),
        duration: z.number().optional(),
      })
    )
    .optional()
    .default([]),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get("projectId")
    const status = searchParams.get("status")

    const meetings = await prisma.meeting.findMany({
      where: {
        workspaceId: session.user.workspaceId,
        ...(projectId ? { projectId } : {}),
        ...(status ? { status: status as "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" } : {}),
      },
      orderBy: { startTime: "asc" },
    })

    // Enrich with project names
    const projectIds = [...new Set(meetings.map((m) => m.projectId).filter(Boolean))] as string[]
    const projects = projectIds.length
      ? await prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true },
        })
      : []
    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]))

    const enriched = meetings.map((m) => ({
      ...m,
      project: m.projectId ? (projectMap[m.projectId] ?? null) : null,
    }))

    return NextResponse.json({ meetings: enriched })
  } catch (err) {
    console.error("[GET /api/meetings]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = createMeetingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const { workspaceId, id: userId } = session.user

    const meeting = await prisma.meeting.create({
      data: {
        workspaceId,
        title: parsed.data.title,
        description: parsed.data.description,
        startTime: new Date(parsed.data.startTime),
        endTime: new Date(parsed.data.endTime),
        location: parsed.data.location,
        projectId: parsed.data.projectId ?? null,
        attendees: parsed.data.attendees,
        agenda: parsed.data.agenda,
        status: "SCHEDULED",
        createdBy: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "meeting",
        entityId: meeting.id,
        action: "CREATE",
        afterState: { title: meeting.title, startTime: meeting.startTime, status: meeting.status },
      },
    })

    return NextResponse.json({ meeting }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/meetings]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
