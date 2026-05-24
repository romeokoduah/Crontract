import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"
import { buildRunPayslips } from "@/lib/payroll/run-builder"

const createSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  employeeIds: z.array(z.string().uuid()).optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const runs = await prisma.payrollRun.findMany({
    where: { workspaceId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { _count: { select: { payslips: true } } },
  })
  return NextResponse.json({ runs })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", detail: parsed.error.issues.map(i => i.message).join(", ") },
      { status: 400 }
    )
  }
  const { year, month, employeeIds } = parsed.data

  const existing = await prisma.payrollRun.findUnique({
    where: { workspaceId_year_month: { workspaceId, year, month } },
  })
  if (existing) {
    return NextResponse.json(
      { error: "Run already exists for this period", existingRunId: existing.id },
      { status: 409 }
    )
  }

  let built
  try {
    built = await buildRunPayslips(workspaceId, year, month, employeeIds)
  } catch (err) {
    console.error("[POST /api/payroll/runs] build error", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  if (built.payslipInputs.length === 0) {
    return NextResponse.json(
      { error: "No eligible employees (all missing basicSalary or excluded)", skipped: built.skipped },
      { status: 400 }
    )
  }

  const totals = built.payslipInputs.reduce((acc, p) => ({
    gross: acc.gross + p.output.gross,
    deductions: acc.deductions + p.output.totalDeductions,
    net: acc.net + p.output.netPay,
    employerCost: acc.employerCost + p.output.gross + p.output.ssnitEmployer + p.output.tier2,
  }), { gross: 0, deductions: 0, net: 0, employerCost: 0 })

  try {
    const run = await prisma.$transaction(async (tx) => {
      const r = await tx.payrollRun.create({
        data: {
          workspaceId, year, month, status: "DRAFT",
          totalGross: totals.gross, totalDeductions: totals.deductions,
          totalNet: totals.net, totalEmployerCost: totals.employerCost,
          createdBy: userId,
        },
      })
      for (const p of built.payslipInputs) {
        await tx.payslip.create({
          data: {
            payrollRunId: r.id,
            employeeId: p.employee.id,
            daysWorked: p.output.snapshot.daysWorked,
            basicSalary: p.output.basicSalary,
            totalEarnings: p.output.totalEarnings,
            totalDeductions: p.output.totalDeductions,
            gross: p.output.gross,
            paye: p.output.paye,
            ssnitEmployee: p.output.ssnitEmployee,
            ssnitEmployer: p.output.ssnitEmployer,
            tier2: p.output.tier2,
            loanDeductions: p.output.loanDeductions,
            otherDeductions: p.output.otherDeductions,
            netPay: p.output.netPay,
            currency: p.employee.currency,
            componentsSnapshot: {
              rates: p.output.snapshot.rates,
              components: p.output.snapshot.components,
              reliefs: p.output.snapshot.reliefs,
              daysWorked: p.output.snapshot.daysWorked,
              daysInMonth: p.output.snapshot.daysInMonth,
              loanApplied: p.output.loanApplied,
            },
            ytdGross: p.output.ytdGross,
            ytdPaye: p.output.ytdPaye,
            ytdSsnit: p.output.ytdSsnit,
            status: "DRAFT",
          },
        })
      }
      await tx.auditLog.create({
        data: {
          workspaceId, userId,
          entityType: "payroll_run", entityId: r.id,
          action: "CREATE",
          afterState: { year, month, count: built.payslipInputs.length, skipped: built.skipped.length },
        },
      })
      return r
    }, { timeout: 30_000 })

    return NextResponse.json({ run, skipped: built.skipped }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/payroll/runs] tx error", err)
    return NextResponse.json({ error: "Failed to create payroll run" }, { status: 500 })
  }
}
