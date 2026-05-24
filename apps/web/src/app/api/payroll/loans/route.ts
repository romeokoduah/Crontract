import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const schema = z.object({
  employeeId: z.string().uuid(),
  principal: z.number().positive(),
  monthlyDeduction: z.number().positive(),
  startMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM format"),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!

  const loans = await prisma.payrollLoan.findMany({
    where: { workspaceId },
    include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ loans })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

  const emp = await prisma.employee.findFirst({ where: { id: parsed.data.employeeId, workspaceId } })
  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

  if (parsed.data.monthlyDeduction > parsed.data.principal) {
    return NextResponse.json({ error: "Monthly deduction cannot exceed principal" }, { status: 400 })
  }

  const loan = await prisma.payrollLoan.create({
    data: {
      workspaceId,
      employeeId: parsed.data.employeeId,
      principal: parsed.data.principal,
      monthlyDeduction: parsed.data.monthlyDeduction,
      startMonth: parsed.data.startMonth,
      balance: parsed.data.principal,
      status: "ACTIVE",
      createdBy: userId,
    },
  })
  await prisma.auditLog.create({
    data: { workspaceId, userId, entityType: "payroll_loan", entityId: loan.id, action: "CREATE", afterState: { principal: parsed.data.principal } },
  })
  return NextResponse.json({ loan }, { status: 201 })
}
