import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createPostSchema = z.object({
  content: z.string().min(1).max(5000),
  mediaUrls: z.array(z.string()).optional(),
  scheduledAt: z.string().optional(),
  tags: z.array(z.string()).optional(),
  campaignName: z.string().optional(),
  accountIds: z.array(z.string().uuid()).min(1, "At least one platform account is required"),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const posts = await prisma.socialPost.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
        deletedAt: null,
      },
      include: {
        platforms: {
          include: { socialAccount: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ posts })
  } catch (err) {
    console.error("[GET /api/social-media/posts]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createPostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    // Determine status
    let status: "DRAFT" | "SCHEDULED" = "DRAFT"
    if (data.scheduledAt) {
      const scheduledDate = new Date(data.scheduledAt)
      if (scheduledDate > new Date()) {
        status = "SCHEDULED"
      }
    }

    // Look up accounts to get platforms
    const accounts = await prisma.socialAccount.findMany({
      where: {
        id: { in: data.accountIds },
        workspaceId,
      },
    })

    if (accounts.length === 0) {
      return NextResponse.json({ error: "No valid accounts found" }, { status: 400 })
    }

    const post = await prisma.socialPost.create({
      data: {
        workspaceId,
        content: data.content,
        mediaUrls: data.mediaUrls ?? [],
        status,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        tags: data.tags ?? [],
        campaignName: data.campaignName,
        createdBy: userId,
        platforms: {
          create: accounts.map((account) => ({
            socialAccountId: account.id,
            platform: account.platform,
            status: "PENDING",
          })),
        },
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
        entityId: post.id,
        action: "CREATE",
        afterState: {
          status: post.status,
          platforms: accounts.map((a) => a.platform),
          contentPreview: post.content.slice(0, 100),
        },
      },
    })

    return NextResponse.json({ post }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/social-media/posts]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
