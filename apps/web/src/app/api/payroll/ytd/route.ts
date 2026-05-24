import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10)
  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 })
  }

  const payslips = await prisma.payslip.findMany({
    where: {
      payrollRun: { workspaceId, year, status: "POSTED" },
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
    },
  })

  const byEmployee = new Map<string, {
    employeeId: string
    name: string
    employeeNumber: string
    runs: number
    gross: number
    paye: number
    ssnitEmployee: number
    ssnitEmployer: number
    tier2: number
    net: number
  }>()

  for (const p of payslips) {
    const key = p.employeeId
    const cur = byEmployee.get(key) ?? {
      employeeId: p.employeeId,
      name: `${p.employee.firstName} ${p.employee.lastName}`,
      employeeNumber: p.employee.employeeNumber,
      runs: 0, gross: 0, paye: 0, ssnitEmployee: 0, ssnitEmployer: 0, tier2: 0, net: 0,
    }
    cur.runs += 1
    cur.gross += Number(p.gross)
    cur.paye += Number(p.paye)
    cur.ssnitEmployee += Number(p.ssnitEmployee)
    cur.ssnitEmployer += Number(p.ssnitEmployer)
    cur.tier2 += Number(p.tier2)
    cur.net += Number(p.netPay)
    byEmployee.set(key, cur)
  }

  const rows = Array.from(byEmployee.values()).sort((a, b) => a.name.localeCompare(b.name))
  return NextResponse.json({ year, rows })
}
