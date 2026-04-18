import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { hashPassword } from "@/lib/auth"

const acceptInviteSchema = z.object({
  token: z.string().uuid(),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = acceptInviteSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          detail: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      )
    }

    const { token, name, password } = parsed.data

    // Find invitation by token
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        workspace: { select: { id: true, name: true } },
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid invitation link" },
        { status: 404 }
      )
    }

    // Check if already accepted
    if (invitation.status === "ACCEPTED") {
      return NextResponse.json(
        { error: "This invitation has already been accepted" },
        { status: 409 }
      )
    }

    // Check if cancelled
    if (invitation.status === "CANCELLED") {
      return NextResponse.json(
        { error: "This invitation has been cancelled" },
        { status: 410 }
      )
    }

    // Check if expired
    if (invitation.status === "EXPIRED" || invitation.expiresAt < new Date()) {
      // Update status to EXPIRED if not already
      if (invitation.status !== "EXPIRED") {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        })
      }
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 410 }
      )
    }

    const normalizedEmail = invitation.email.toLowerCase()

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    // Check if already a member
    if (existingUser) {
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_workspaceId: {
            userId: existingUser.id,
            workspaceId: invitation.workspaceId,
          },
        },
      })

      if (existingMembership) {
        return NextResponse.json(
          { error: "Already a member of this workspace" },
          { status: 409 }
        )
      }
    }

    // Perform the acceptance in a transaction
    const result = await prisma.$transaction(async (tx) => {
      let user = existingUser

      if (!user) {
        // Create new user
        const passwordHash = await hashPassword(password)
        user = await tx.user.create({
          data: {
            name,
            email: normalizedEmail,
            passwordHash,
          },
        })
      }

      // Create membership linking user to workspace with invitation's role
      await tx.membership.create({
        data: {
          userId: user.id,
          workspaceId: invitation.workspaceId,
          roleId: invitation.roleId,
        },
      })

      // Mark invitation as accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      })

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
          entityType: "invitation",
          entityId: invitation.id,
          action: "invitation_accepted",
          afterState: {
            email: normalizedEmail,
            name: user.name,
            roleId: invitation.roleId,
          },
        },
      })

      return user
    })

    return NextResponse.json(
      {
        user: {
          id: result.id,
          email: result.email,
          name: result.name,
        },
      },
      { status: 200 }
    )
  } catch (err) {
    console.error("[accept-invite]", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
