import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import JSZip from "jszip"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"
import { renderPayslipPdf } from "@/lib/pdf/payslip"

function buildPdfProps(workspaceName: string, p: Awaited<ReturnType<typeof loadRun>>["payslips"][number]) {
  const snap = p.componentsSnapshot as { components?: { name: string; type: string; amount: number }[] }
  const earnings = (snap?.components ?? [])
    .filter(c => c.type === "EARNING")
    .map(c => ({ name: c.name, amount: Number(c.amount) }))
  const earningsWithBasic = [{ name: "Basic Salary", amount: Number(p.basicSalary) }, ...earnings]
  const deductions = [
    { name: "PAYE", amount: Number(p.paye) },
    { name: "SSNIT (5.5%)", amount: Number(p.ssnitEmployee) },
    { name: "Tier 2 (5%)", amount: Number(p.tier2) },
    ...(Number(p.loanDeductions) > 0 ? [{ name: "Loan Repayment", amount: Number(p.loanDeductions) }] : []),
    ...(Number(p.otherDeductions) > 0 ? [{ name: "Other Deductions", amount: Number(p.otherDeductions) }] : []),
  ]
  return {
    workspaceName,
    employee: {
      name: `${p.employee.firstName} ${p.employee.lastName}`,
      employeeNumber: p.employee.employeeNumber,
      jobTitle: p.employee.jobTitle,
      tin: p.employee.tin,
      ssnitNumber: p.employee.ssnitNumber,
      bankName: p.employee.bankName,
      bankAccount: p.employee.bankAccount,
      momoNumber: p.employee.momoNumber,
    },
    period: { year: p.payrollRun_year, month: p.payrollRun_month },
    currency: p.currency,
    earnings: earningsWithBasic,
    deductions,
    totals: {
      gross: Number(p.gross),
      totalDeductions: Number(p.totalDeductions),
      netPay: Number(p.netPay),
    },
    ytd: { gross: Number(p.ytdGross), paye: Number(p.ytdPaye), ssnit: Number(p.ytdSsnit) },
  }
}

async function loadRun(workspaceId: string, runId: string) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, workspaceId },
    include: {
      workspace: { select: { name: true } },
      payslips: { include: { employee: true } },
    },
  })
  if (!run) throw new Error("Not found")
  return {
    workspaceName: run.workspace.name,
    year: run.year,
    month: run.month,
    payslips: run.payslips.map(p => ({
      ...p,
      payrollRun_year: run.year,
      payrollRun_month: run.month,
    })),
  }
}

export async function GET(_: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!

  let data
  try {
    data = await loadRun(workspaceId, ctx.params.id)
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (data.payslips.length === 0) {
    return NextResponse.json({ error: "No payslips on this run" }, { status: 400 })
  }

  const zip = new JSZip()
  for (const p of data.payslips) {
    const pdf = await renderPayslipPdf(buildPdfProps(data.workspaceName, p))
    const filename = `payslip-${p.employee.employeeNumber}-${data.year}-${String(data.month).padStart(2, "0")}.pdf`
    zip.file(filename, pdf)
  }
  const buf = await zip.generateAsync({ type: "nodebuffer" })

  const zipName = `payslips-${data.year}-${String(data.month).padStart(2, "0")}.zip`
  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
    },
  })
}
