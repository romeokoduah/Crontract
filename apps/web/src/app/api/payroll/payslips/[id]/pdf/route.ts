import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { isAdmin } from "@/lib/authorization"
import { renderPayslipPdf } from "@/lib/pdf/payslip"

export async function GET(_: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const workspaceId = session.user.workspaceId
  const userId = session.user.id

  const payslip = await prisma.payslip.findFirst({
    where: { id: ctx.params.id, employee: { workspaceId } },
    include: {
      employee: true,
      payrollRun: { include: { workspace: { select: { name: true } } } },
    },
  })
  if (!payslip) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Authz: admin OR own payslip
  if (!isAdmin(session) && payslip.employee.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const snap = payslip.componentsSnapshot as { components?: { name: string; type: string; amount: number }[] }
  const earnings = (snap?.components ?? [])
    .filter(c => c.type === "EARNING")
    .map(c => ({ name: c.name, amount: Number(c.amount) }))

  // Always include the basic salary as an earnings line
  const earningsWithBasic = [
    { name: "Basic Salary", amount: Number(payslip.basicSalary) },
    ...earnings,
  ]

  const deductions: { name: string; amount: number }[] = [
    { name: "PAYE", amount: Number(payslip.paye) },
    { name: "SSNIT (5.5%)", amount: Number(payslip.ssnitEmployee) },
    { name: "Tier 2 (5%)", amount: Number(payslip.tier2) },
    ...(Number(payslip.loanDeductions) > 0 ? [{ name: "Loan Repayment", amount: Number(payslip.loanDeductions) }] : []),
    ...(Number(payslip.otherDeductions) > 0 ? [{ name: "Other Deductions", amount: Number(payslip.otherDeductions) }] : []),
  ]

  const buf = await renderPayslipPdf({
    workspaceName: payslip.payrollRun.workspace.name,
    employee: {
      name: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
      employeeNumber: payslip.employee.employeeNumber,
      jobTitle: payslip.employee.jobTitle,
      tin: payslip.employee.tin,
      ssnitNumber: payslip.employee.ssnitNumber,
      bankName: payslip.employee.bankName,
      bankAccount: payslip.employee.bankAccount,
      momoNumber: payslip.employee.momoNumber,
    },
    period: { year: payslip.payrollRun.year, month: payslip.payrollRun.month },
    currency: payslip.currency,
    earnings: earningsWithBasic,
    deductions,
    totals: {
      gross: Number(payslip.gross),
      totalDeductions: Number(payslip.totalDeductions),
      netPay: Number(payslip.netPay),
    },
    ytd: {
      gross: Number(payslip.ytdGross),
      paye: Number(payslip.ytdPaye),
      ssnit: Number(payslip.ytdSsnit),
    },
  })

  const filename = `payslip-${payslip.employee.employeeNumber}-${payslip.payrollRun.year}-${String(payslip.payrollRun.month).padStart(2, "0")}.pdf`
  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
