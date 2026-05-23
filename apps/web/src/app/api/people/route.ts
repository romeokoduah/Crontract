import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { authOptions, hashPassword } from "@/lib/auth"
import { isAdmin, requireAuth, requireAdminRole } from "@/lib/authorization"

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

const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  employeeNumber: z.string().min(1).max(50),
  jobTitle: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "VOLUNTEER"]).default("FULL_TIME"),
  startDate: z.string().min(1),
  basicSalary: z.number().optional(),
  ssnitNumber: z.string().max(50).optional(),
  tin: z.string().max(50).optional(),
  bankName: z.string().max(100).optional(),
  bankAccount: z.string().max(50).optional(),
  momoNumber: z.string().max(30).optional(),
  currency: z.string().length(3).default("GHS"),
  taxReliefs: z.object({
    personal: z.boolean().default(true),
    marriage: z.boolean().default(false),
    dependantChildren: z.number().int().min(0).max(3).default(0),
    oldAge: z.boolean().default(false),
    agedDependant: z.boolean().default(false),
    disability: z.boolean().default(false),
  }).optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const authDenied = requireAuth(session)
    if (authDenied) return authDenied

    const workspaceId = session!.user.workspaceId!
    const admin = isAdmin(session)

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const departmentId = searchParams.get("departmentId")

    const employees = await prisma.employee.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(status ? { status: status as "ACTIVE" | "ON_LEAVE" | "SUSPENDED" | "TERMINATED" | "RESIGNED" } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(!admin ? { email: session!.user.email.toLowerCase() } : {}),
      },
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    })

    return NextResponse.json({ employees })
  } catch (err) {
    console.error("[GET /api/people]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createEmployeeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!

    // Check unique employee number
    const existing = await prisma.employee.findFirst({
      where: { workspaceId, employeeNumber: data.employeeNumber, deletedAt: null },
    })
    if (existing) {
      return NextResponse.json({ error: "Employee number already in use" }, { status: 409 })
    }

    const employee = await prisma.employee.create({
      data: {
        workspaceId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email.toLowerCase(),
        phone: data.phone,
        employeeNumber: data.employeeNumber,
        jobTitle: data.jobTitle,
        departmentId: data.departmentId,
        managerId: data.managerId,
        employmentType: data.employmentType,
        startDate: new Date(data.startDate),
        basicSalary: data.basicSalary ?? undefined,
        ssnitNumber: data.ssnitNumber,
        tin: data.tin,
        bankName: data.bankName,
        bankAccount: data.bankAccount,
        momoNumber: data.momoNumber,
        currency: data.currency,
        taxReliefs: data.taxReliefs ?? undefined,
        emergencyName: data.emergencyName,
        emergencyPhone: data.emergencyPhone,
        status: "ACTIVE",
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    })

    // --- Create User account with temporary password ---
    const tempPassword = generateTempPassword()
    const passwordHash = await hashPassword(tempPassword)

    let user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } })
    let userCreated = false
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: `${data.firstName} ${data.lastName}`,
          email: data.email.toLowerCase(),
          passwordHash,
          mustChangePassword: true,
          tempPasswordExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      })
      userCreated = true
    }

    // Find or create "Team Member" role
    let role = await prisma.role.findFirst({
      where: { workspaceId, name: "Team Member" },
    })
    if (!role) {
      role = await prisma.role.create({
        data: {
          workspaceId,
          name: "Team Member",
          description: "Standard employee access",
          isSystem: true,
        },
      })
    }

    // Check if membership already exists
    const existingMembership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId } },
    })
    if (!existingMembership) {
      await prisma.membership.create({
        data: { userId: user.id, workspaceId, roleId: role.id },
      })
    }

    // Link employee record to user
    await prisma.employee.update({
      where: { id: employee.id },
      data: { userId: user.id },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId: session!.user.id,
        entityType: "employee",
        entityId: employee.id,
        action: "CREATE",
        afterState: {
          name: `${employee.firstName} ${employee.lastName}`,
          employeeNumber: employee.employeeNumber,
          userCreated,
        },
      },
    })

    return NextResponse.json({
      employee,
      tempPassword: userCreated ? tempPassword : undefined,
      userCreated,
    }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/people]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
