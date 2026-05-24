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
    include: {
      payslips: { include: { employee: true } },
    },
  })
  if (!run) return NextResponse.json({ error: "No run for this period" }, { status: 404 })
  if (run.status !== "POSTED") {
    return NextResponse.json({ error: `Run is ${run.status}, not POSTED — cannot export statutory schedule` }, { status: 400 })
  }

  const header = ["SSNIT Number", "Employee Name", "Basic Salary (GHS)", "Employee Contribution (5.5%)", "Employer Contribution (13%)", "Total (18.5%)"]
  const rows = run.payslips.map(p => {
    const employee = p.employee.firstName + " " + p.employee.lastName
    return [
      p.employee.ssnitNumber ?? "",
      employee,
      Number(p.basicSalary).toFixed(2),
      Number(p.ssnitEmployee).toFixed(2),
      Number(p.ssnitEmployer).toFixed(2),
      (Number(p.ssnitEmployee) + Number(p.ssnitEmployer)).toFixed(2),
    ]
  })

  const totals = run.payslips.reduce(
    (a, p) => ({
      ee: a.ee + Number(p.ssnitEmployee),
      er: a.er + Number(p.ssnitEmployer),
    }),
    { ee: 0, er: 0 }
  )
  rows.push(["", "TOTAL", "", totals.ee.toFixed(2), totals.er.toFixed(2), (totals.ee + totals.er).toFixed(2)])

  const csv = [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n")
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ssnit-${year}-${String(month).padStart(2, "0")}.csv"`,
    },
  })
}
