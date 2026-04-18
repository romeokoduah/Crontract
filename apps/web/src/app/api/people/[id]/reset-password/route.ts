import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { authOptions, hashPassword } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

function generateTempPassword(): string {
  const length = 12
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
  const bytes = crypto.randomBytes(length)
  let password = ""
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length]
  }
  // Ensure at least one of each required type
  const ensure = [
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "abcdefghijklmnopqrstuvwxyz",
    "0123456789",
    "!@#$%^&*",
  ]
  for (let i = 0; i < ensure.length; i++) {
    const chars = ensure[i]
    const pos = crypto.randomInt(password.length)
    const char = chars[crypto.randomInt(chars.length)]
    password = password.substring(0, pos) + char + password.substring(pos + 1)
  }
  return password
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const { id } = params
    const workspaceId = session!.user.workspaceId!

    // Find the employee
    const employee = await prisma.employee.findFirst({
      where: { id, workspaceId, deletedAt: null },
    })
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }
    if (!employee.userId) {
      return NextResponse.json({ error: "Employee has no linked user account" }, { status: 400 })
    }

    // Generate new temp password and update user
    const tempPassword = generateTempPassword()
    const passwordHash = await hashPassword(tempPassword)

    await prisma.user.update({
      where: { id: employee.userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        tempPasswordExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId: session!.user.id,
        entityType: "user",
        entityId: employee.userId,
        action: "FORCE_PASSWORD_RESET",
        afterState: {
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
        },
      },
    })

    return NextResponse.json({ tempPassword }, { status: 200 })
  } catch (err) {
    console.error("[POST /api/people/[id]/reset-password]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
