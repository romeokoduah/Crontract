import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const patchMeetingSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  attendees: z.array(z.string()).optional(),
  agenda: z.array(z.object({ topic: z.string(), duration: z.number().optional() })).optional(),
  minutes: z.string().optional(),
  decisions: z.array(z.object({ text: z.string(), owner: z.string().optional() })).optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const meeting = await prisma.meeting.findFirst({
      where: { id: params.id, workspaceId: session.user.workspaceId },
    })
    if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Enrich with project name
    const project = meeting.projectId
      ? await prisma.project.findFirst({
          where: { id: meeting.projectId },
          select: { id: true, name: true },
        })
      : null

    // Enrich with creator name
    const creator = await prisma.user.findUnique({
      where: { id: meeting.createdBy },
      select: { id: true, name: true },
    })

    return NextResponse.json({ meeting: { ...meeting, project, creator } })
  } catch (err) {
    console.error("[GET /api/meetings/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session.user.workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const existing = await prisma.meeting.findFirst({
      where: { id: params.id, workspaceId: session.user.workspaceId },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await req.json()
    const parsed = patchMeetingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const { workspaceId, id: userId } = session.user
    const data = parsed.data

    const meeting = await prisma.meeting.update({
      where: { id: params.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.startTime !== undefined ? { startTime: new Date(data.startTime) } : {}),
        ...(data.endTime !== undefined ? { endTime: new Date(data.endTime) } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.attendees !== undefined ? { attendees: data.attendees } : {}),
        ...(data.agenda !== undefined ? { agenda: data.agenda } : {}),
        ...(data.minutes !== undefined ? { minutes: data.minutes } : {}),
        ...(data.decisions !== undefined ? { decisions: data.decisions } : {}),
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "meeting",
        entityId: meeting.id,
        action: "UPDATE",
        beforeState: { status: existing.status },
        afterState: { title: meeting.title, status: meeting.status },
      },
    })

    return NextResponse.json({ meeting })
  } catch (err) {
    console.error("[PATCH /api/meetings/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
