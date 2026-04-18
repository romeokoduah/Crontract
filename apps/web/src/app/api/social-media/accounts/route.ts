import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createAccountSchema = z.object({
  platform: z.enum(["FACEBOOK", "INSTAGRAM", "TWITTER", "LINKEDIN", "TIKTOK", "YOUTUBE"]),
  accountName: z.string().min(1),
  handle: z.string().min(1),
  avatarUrl: z.string().url().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const accounts = await prisma.socialAccount.findMany({
      where: { workspaceId: session!.user.workspaceId! },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ accounts })
  } catch (err) {
    console.error("[GET /api/social-media/accounts]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createAccountSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const account = await prisma.socialAccount.create({
      data: {
        workspaceId,
        platform: data.platform,
        accountName: data.accountName,
        handle: data.handle,
        avatarUrl: data.avatarUrl,
        isConnected: true,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "social_account",
        entityId: account.id,
        action: "CREATE",
        afterState: { platform: account.platform, accountName: account.accountName, handle: account.handle },
      },
    })

    return NextResponse.json({ account }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/social-media/accounts]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id || !z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Invalid or missing id" }, { status: 400 })
    }

    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const account = await prisma.socialAccount.findFirst({
      where: { id, workspaceId },
    })

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    await prisma.socialAccount.delete({ where: { id } })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "social_account",
        entityId: id,
        action: "DELETE",
        beforeState: { platform: account.platform, accountName: account.accountName, handle: account.handle },
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/social-media/accounts]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
