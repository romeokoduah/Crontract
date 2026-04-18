import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).optional(), // if empty, mark all
  markAll: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session!.user.workspaceId!) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get("unread") === "true"

    const notifications = await prisma.notification.findMany({
      where: {
        userId: session!.user.id,
        workspaceId: session!.user.workspaceId!,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    const unreadCount = await prisma.notification.count({
      where: {
        userId: session!.user.id,
        workspaceId: session!.user.workspaceId!,
        read: false,
      },
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch (err) {
    console.error("[GET /api/notifications]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    if (!session!.user.workspaceId!) return NextResponse.json({ error: "No workspace" }, { status: 403 })

    const body = await req.json()
    const parsed = markReadSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

    const userId = session!.user.id
    const workspaceId = session!.user.workspaceId!
    const { ids, markAll } = parsed.data

    if (markAll || !ids || ids.length === 0) {
      // Mark all as read
      await prisma.notification.updateMany({
        where: { userId, workspaceId, read: false },
        data: { read: true },
      })
    } else {
      // Mark specific ones as read
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId, workspaceId },
        data: { read: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[PATCH /api/notifications]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
