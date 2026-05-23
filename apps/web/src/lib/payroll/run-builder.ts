import { prisma } from "@/lib/db"
import { loadRatePack } from "./rate-loader"
import { computePayslip } from "./tax-ghana"
import type { PayslipComponent, Reliefs, PayslipOutput } from "./types"

type EmployeeRow = Awaited<ReturnType<typeof loadEmployees>>[number]

async function loadEmployees(workspaceId: string, year: number, month: number, employeeIds?: string[]) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const periodStart = new Date(year, month - 1, 1)
  const periodEnd = new Date(year, month - 1, daysInMonth)

  return prisma.employee.findMany({
    where: {
      workspaceId,
      status: "ACTIVE",
      deletedAt: null,
      ...(employeeIds?.length ? { id: { in: employeeIds } } : {}),
    },
    include: {
      paySetups: {
        where: {
          startDate: { lte: periodEnd },
          OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
        },
        include: { payComponent: true },
      },
      loans: { where: { status: "ACTIVE", balance: { gt: 0 } } },
    },
  })
}

export type BuiltPayslip = { employee: EmployeeRow; output: PayslipOutput }
export type RunBuildResult = {
  payslipInputs: BuiltPayslip[]
  skipped: { employeeId: string; reason: string }[]
  daysInMonth: number
}

export async function buildRunPayslips(
  workspaceId: string,
  year: number,
  month: number,
  employeeIds?: string[],
): Promise<RunBuildResult> {
  const daysInMonth = new Date(year, month, 0).getDate()
  const rates = await loadRatePack(workspaceId, year)

  const employees = await loadEmployees(workspaceId, year, month, employeeIds)
  const skipped: { employeeId: string; reason: string }[] = []
  const payslipInputs: BuiltPayslip[] = []

  // YTD: sum prior POSTED payslips for this calendar year
  const ytdMap = new Map<string, { gross: number; paye: number; ssnit: number }>()
  if (employees.length > 0) {
    const priorPayslips = await prisma.payslip.findMany({
      where: {
        payrollRun: { workspaceId, year, month: { lt: month }, status: "POSTED" },
        employeeId: { in: employees.map(e => e.id) },
      },
      select: { employeeId: true, gross: true, paye: true, ssnitEmployee: true },
    })
    for (const p of priorPayslips) {
      const cur = ytdMap.get(p.employeeId) ?? { gross: 0, paye: 0, ssnit: 0 }
      ytdMap.set(p.employeeId, {
        gross: cur.gross + Number(p.gross),
        paye: cur.paye + Number(p.paye),
        ssnit: cur.ssnit + Number(p.ssnitEmployee),
      })
    }
  }

  for (const e of employees) {
    if (e.basicSalary == null) {
      skipped.push({ employeeId: e.id, reason: "MISSING_BASIC_SALARY" })
      continue
    }
    const components: PayslipComponent[] = e.paySetups
      .filter(s => s.payComponent.type === "EARNING" || s.payComponent.type === "DEDUCTION")
      .map(s => ({
        componentId: s.payComponentId,
        code: s.payComponent.code,
        name: s.payComponent.name,
        type: s.payComponent.type as "EARNING" | "DEDUCTION",
        taxable: s.payComponent.taxable,
        pensionable: s.payComponent.pensionable,
        amount: Number(s.amount),
      }))
    const reliefs = (e.taxReliefs as Reliefs | null) ?? { personal: true }
    const loans = e.loans.map(l => ({
      id: l.id,
      monthlyDeduction: Number(l.monthlyDeduction),
      balance: Number(l.balance),
    }))
    const ytd = ytdMap.get(e.id) ?? { gross: 0, paye: 0, ssnit: 0 }

    const output = computePayslip({
      basicSalary: Number(e.basicSalary),
      components,
      daysWorked: daysInMonth,
      daysInMonth,
      reliefs,
      loans,
      rates,
      ytd,
    })
    payslipInputs.push({ employee: e, output })
  }

  return { payslipInputs, skipped, daysInMonth }
}
