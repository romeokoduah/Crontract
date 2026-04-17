import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

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
  salary: z.number().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }
    if (!session.user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const departmentId = searchParams.get("departmentId")

    const employees = await prisma.employee.findMany({
      where: {
        workspaceId: session.user.workspaceId,
        deletedAt: null,
        ...(status ? { status: status as "ACTIVE" | "ON_LEAVE" | "SUSPENDED" | "TERMINATED" | "RESIGNED" } : {}),
        ...(departmentId ? { departmentId } : {}),
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }
    if (!session.user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createEmployeeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session.user.workspaceId

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
        salary: data.salary ? data.salary : undefined,
        emergencyName: data.emergencyName,
        emergencyPhone: data.emergencyPhone,
        status: "ACTIVE",
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId: session.user.id,
        entityType: "employee",
        entityId: employee.id,
        action: "CREATE",
        afterState: {
          name: `${employee.firstName} ${employee.lastName}`,
          employeeNumber: employee.employeeNumber,
        },
      },
    })

    return NextResponse.json({ employee }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/people]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
