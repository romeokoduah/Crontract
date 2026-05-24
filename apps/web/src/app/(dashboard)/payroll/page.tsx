import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Settings, Coins, Users, AlertCircle } from "lucide-react"

export const metadata = { title: "Payroll — Crontract" }

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-blue-50 text-blue-700 border-blue-200",
  POSTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REVERSED: "bg-rose-50 text-rose-700 border-rose-200",
}

export default async function PayrollPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) redirect("/login")
  const workspaceId = session.user.workspaceId

  const [runs, mappingCount, employeeCount] = await Promise.all([
    prisma.payrollRun.findMany({
      where: { workspaceId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { _count: { select: { payslips: true } } },
    }),
    prisma.payrollGlMapping.count({ where: { workspaceId } }),
    prisma.employee.count({
      where: { workspaceId, status: "ACTIVE", deletedAt: null, basicSalary: { not: null } },
    }),
  ])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payroll</h1>
          <p className="text-sm text-muted-foreground mt-1">Monthly Ghana-statutory payroll runs.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/payroll/components"><Button variant="outline" size="sm"><Coins className="h-4 w-4 mr-1.5" /> Components</Button></Link>
          <Link href="/payroll/loans"><Button variant="outline" size="sm">Loans</Button></Link>
          <Link href="/payroll/ytd"><Button variant="outline" size="sm">YTD</Button></Link>
          <Link href="/payroll/statutory"><Button variant="outline" size="sm">Statutory</Button></Link>
          <Link href="/payroll/gl-mapping"><Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-1.5" /> GL Mapping</Button></Link>
          <Link href="/payroll/runs/new"><Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> New Run</Button></Link>
        </div>
      </div>

      {mappingCount < 8 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 flex items-start gap-2 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <div>
            GL mapping incomplete ({mappingCount}/8). Runs can be created and approved, but cannot be POSTED until all 8 lines are mapped.{" "}
            <Link href="/payroll/gl-mapping" className="underline">Configure now</Link>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Eligible employees</div>
            <div className="text-2xl font-semibold mt-1 flex items-center gap-2"><Users className="h-5 w-5 text-muted-foreground" />{employeeCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Active with basic salary set</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Runs to date</div>
            <div className="text-2xl font-semibold mt-1">{runs.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Across all statuses</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">GL mapping</div>
            <div className="text-2xl font-semibold mt-1">{mappingCount}/8</div>
            <div className="text-xs text-muted-foreground mt-1">Lines configured</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3">Period</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Employees</th>
                <th className="p-3 text-right">Gross (GHS)</th>
                <th className="p-3 text-right">Deductions</th>
                <th className="p-3 text-right">Net Pay</th>
                <th className="p-3 text-right">Employer Cost</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No payroll runs yet. Click "New Run" to start.</td></tr>
              )}
              {runs.map(r => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">{MONTHS[r.month - 1]} {r.year}</td>
                  <td className="p-3"><span className={`inline-block px-2 py-0.5 rounded text-xs border ${STATUS_COLOR[r.status]}`}>{r.status}</span></td>
                  <td className="p-3 text-right">{r._count.payslips}</td>
                  <td className="p-3 text-right font-mono">{Number(r.totalGross).toLocaleString()}</td>
                  <td className="p-3 text-right font-mono">{Number(r.totalDeductions).toLocaleString()}</td>
                  <td className="p-3 text-right font-mono">{Number(r.totalNet).toLocaleString()}</td>
                  <td className="p-3 text-right font-mono">{Number(r.totalEmployerCost).toLocaleString()}</td>
                  <td className="p-3 text-right">
                    <Link href={`/payroll/runs/${r.id}`}><Button size="sm" variant="ghost">Open</Button></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
