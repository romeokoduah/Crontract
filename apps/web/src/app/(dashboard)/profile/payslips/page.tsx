import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FileDown } from "lucide-react"

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

export const metadata = { title: "My Payslips — Crontract" }

export default async function MyPayslipsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.workspaceId) redirect("/login")

  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id, workspaceId: session.user.workspaceId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, employeeNumber: true },
  })

  const payslips = employee
    ? await prisma.payslip.findMany({
        where: { employeeId: employee.id, payrollRun: { status: "POSTED" } },
        include: { payrollRun: { select: { year: true, month: true, postedAt: true } } },
        orderBy: [{ payrollRun: { year: "desc" } }],
      })
    : []

  // Manually sort by (year desc, month desc) — Prisma's orderBy can't compound on a relation in v5 without raw
  payslips.sort((a, b) => (b.payrollRun.year - a.payrollRun.year) || (b.payrollRun.month - a.payrollRun.month))

  return (
    <div className="p-6 max-w-3xl">
      <Link href="/profile" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to profile
      </Link>
      <h1 className="text-2xl font-semibold">My Payslips</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Your monthly payslips. Only POSTED runs appear here.
      </p>

      {!employee && (
        <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 p-4 text-sm">
          Your user account isn't linked to an employee record in this workspace, so no payslips are visible.
          Ask an administrator to link your account.
        </div>
      )}

      {employee && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Period</th>
                  <th className="p-3">Posted</th>
                  <th className="p-3 text-right">Gross ({payslips[0]?.currency ?? "GHS"})</th>
                  <th className="p-3 text-right">Deductions</th>
                  <th className="p-3 text-right">Net Pay</th>
                  <th className="p-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {payslips.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No payslips yet.</td></tr>
                )}
                {payslips.map(p => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{MONTHS[p.payrollRun.month - 1]} {p.payrollRun.year}</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {p.payrollRun.postedAt ? new Date(p.payrollRun.postedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3 text-right font-mono">{Number(p.gross).toLocaleString()}</td>
                    <td className="p-3 text-right font-mono">{Number(p.totalDeductions).toLocaleString()}</td>
                    <td className="p-3 text-right font-mono font-semibold">{Number(p.netPay).toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <a href={`/api/payroll/payslips/${p.id}/pdf`} target="_blank" rel="noopener">
                        <Button size="sm" variant="outline"><FileDown className="h-3.5 w-3.5 mr-1" /> PDF</Button>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
