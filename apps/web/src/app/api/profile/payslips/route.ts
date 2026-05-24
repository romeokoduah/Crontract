import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id
  const workspaceId = session.user.workspaceId

  // Resolve the current user's employee record in this workspace
  const employee = await prisma.employee.findFirst({
    where: { userId, workspaceId, deletedAt: null },
    select: { id: true },
  })
  if (!employee) return NextResponse.json({ payslips: [] })

  const payslips = await prisma.payslip.findMany({
    where: {
      employeeId: employee.id,
      payrollRun: { status: "POSTED" },
    },
    include: {
      payrollRun: { select: { year: true, month: true, postedAt: true } },
    },
    orderBy: { payrollRun: { year: "desc" } },
  })

  return NextResponse.json({
    payslips: payslips.map(p => ({
      id: p.id,
      year: p.payrollRun.year,
      month: p.payrollRun.month,
      postedAt: p.payrollRun.postedAt,
      gross: Number(p.gross),
      totalDeductions: Number(p.totalDeductions),
      netPay: Number(p.netPay),
      currency: p.currency,
    })),
  })
}
