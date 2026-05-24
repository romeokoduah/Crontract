import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

function csvEscape(v: string | number | null | undefined) {
  if (v == null) return ""
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(_: NextRequest, ctx: { params: { year: string; month: string } }) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const year = parseInt(ctx.params.year, 10)
  const month = parseInt(ctx.params.month, 10)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 })
  }

  const run = await prisma.payrollRun.findUnique({
    where: { workspaceId_year_month: { workspaceId, year, month } },
    include: { payslips: { include: { employee: true } } },
  })
  if (!run) return NextResponse.json({ error: "No run for this period" }, { status: 404 })
  if (run.status !== "POSTED") {
    return NextResponse.json({ error: `Run is ${run.status}, not POSTED` }, { status: 400 })
  }

  const header = ["TIN", "Employee Name", "Gross Pay (GHS)", "SSNIT Deduction", "Taxable Income (annualised)", "PAYE Monthly", "PAYE Annual"]
  const rows = run.payslips.map(p => {
    const monthlyPaye = Number(p.paye)
    const ssnit = Number(p.ssnitEmployee)
    const gross = Number(p.gross)
    const annualGross = gross * 12
    const annualSsnit = ssnit * 12
    const annualTaxable = annualGross - annualSsnit
    return [
      p.employee.tin ?? "",
      p.employee.firstName + " " + p.employee.lastName,
      gross.toFixed(2),
      ssnit.toFixed(2),
      annualTaxable.toFixed(2),
      monthlyPaye.toFixed(2),
      (monthlyPaye * 12).toFixed(2),
    ]
  })

  const total = run.payslips.reduce((a, p) => a + Number(p.paye), 0)
  rows.push(["", "TOTAL", "", "", "", total.toFixed(2), (total * 12).toFixed(2)])

  const csv = [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n")
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="paye-${year}-${String(month).padStart(2, "0")}.csv"`,
    },
  })
}
