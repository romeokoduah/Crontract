import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAuth } from "@/lib/authorization"

export const runtime = "nodejs"

/**
 * GET /api/ai/conversations            → recent conversations for the current user
 * GET /api/ai/conversations?id=<uuid>  → messages for one conversation
 * Always scoped to the caller's workspace + user.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAuth(session)
    if (denied) return denied

    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id
    const id = new URL(req.url).searchParams.get("id")

    if (id) {
      const conversation = await prisma.aiConversation.findFirst({
        where: { id, workspaceId, userId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            select: { id: true, role: true, content: true, toolTrace: true, createdAt: true },
          },
        },
      })
      if (!conversation) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
      return NextResponse.json({ conversation })
    }

    const conversations = await prisma.aiConversation.findMany({
      where: { workspaceId, userId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true, updatedAt: true },
    })
    return NextResponse.json({ conversations })
  } catch (err) {
    console.error("[GET /api/ai/conversations]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
