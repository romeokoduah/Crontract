import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"
import { randomUUID } from "crypto"

const publishSchema = z.object({
  postId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = publishSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const { postId } = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const post = await prisma.socialPost.findFirst({
      where: { id: postId, workspaceId },
      include: { platforms: true },
    })

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // Update each platform entry
    for (const platform of post.platforms) {
      const platformPostId = randomUUID()
      await prisma.socialPostPlatform.update({
        where: { id: platform.id },
        data: {
          status: "PUBLISHED",
          platformPostId,
          publishedUrl: `https://${platform.platform.toLowerCase()}.com/post/${platformPostId}`,
          engagement: {
            likes: 0,
            comments: 0,
            shares: 0,
            reach: 0,
            impressions: 0,
            clicks: 0,
          },
        },
      })
    }

    // Update the parent post
    const updatedPost = await prisma.socialPost.update({
      where: { id: postId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      include: {
        platforms: {
          include: { socialAccount: true },
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "social_post",
        entityId: postId,
        action: "UPDATE",
        beforeState: { status: post.status },
        afterState: {
          status: "PUBLISHED",
          publishedAt: updatedPost.publishedAt,
          platformCount: post.platforms.length,
        },
      },
    })

    return NextResponse.json({ post: updatedPost })
  } catch (err) {
    console.error("[POST /api/social-media/posts/publish]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
