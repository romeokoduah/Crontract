import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createTalkSchema = z.object({
  title: z.string().min(1).max(500),
  topic: z.string().min(1),
  date: z.string(),
  location: z.string().min(1),
  attendees: z.array(z.object({ name: z.string(), employeeId: z.string().optional(), signed: z.boolean().default(false) })).default([]),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const talks = await prisma.toolboxTalk.findMany({
      where: { workspaceId: session!.user.workspaceId! },
      orderBy: { date: "desc" },
    })

    // Enrich with conductor name
    const userIds = [...new Set(talks.map((t) => t.conductedBy).filter(Boolean))]
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : []
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    const enriched = talks.map((t) => ({ ...t, conductedByUser: userMap[t.conductedBy] ?? null }))
    return NextResponse.json({ talks: enriched })
  } catch (err) {
    console.error("[GET /api/hse/toolbox-talks]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createTalkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const talk = await prisma.toolboxTalk.create({
      data: {
        workspaceId,
        title: parsed.data.title,
        topic: parsed.data.topic,
        conductedBy: userId,
        date: new Date(parsed.data.date),
        location: parsed.data.location,
        attendees: parsed.data.attendees,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "toolbox_talk",
        entityId: talk.id,
        action: "CREATE",
        afterState: { title: talk.title, date: talk.date },
      },
    })

    return NextResponse.json({ talk }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/hse/toolbox-talks]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
