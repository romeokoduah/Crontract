import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions, hashPassword } from "@/lib/auth"
import { compare } from "bcryptjs"

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[a-z]/, "Must contain at least one lowercase letter")
    .regex(/[0-9]/, "Must contain at least one digit")
    .regex(/[^A-Za-z0-9]/, "Must contain at least one symbol"),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const body = await req.json()
    const parsed = changePasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          detail: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = parsed.data

    // Reject if new === current
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from the current password" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session!.user.id },
    })

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify current password
    const isValid = await compare(currentPassword, user.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      )
    }

    // Hash and update
    const newHash = await hashPassword(newPassword)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        passwordSetAt: new Date(),
        tempPasswordExpiresAt: null,
      },
    })

    // Audit log
    const workspaceId = session!.user.workspaceId!
    if (workspaceId) {
      await prisma.auditLog.create({
        data: {
          workspaceId,
          userId: user.id,
          entityType: "user",
          entityId: user.id,
          action: "PASSWORD_CHANGE",
          afterState: {
            mustChangePassword: false,
            selfInitiated: true,
          },
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[POST /api/auth/change-password]", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
