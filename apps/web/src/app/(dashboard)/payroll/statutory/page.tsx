import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileDown } from "lucide-react"

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

export const metadata = { title: "Statutory Exports — Crontract" }

export default async function StatutoryPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) redirect("/login")

  const runs = await prisma.payrollRun.findMany({
    where: { workspaceId: session.user.workspaceId, status: "POSTED" },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { id: true, year: true, month: true, totalGross: true },
  })

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold">Statutory Exports</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        SSNIT contribution schedules and GRA PAYE schedules. Only POSTED runs can be exported.
      </p>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3">Period</th>
                <th className="p-3 text-right">Total Gross (GHS)</th>
                <th className="p-3 text-right">SSNIT</th>
                <th className="p-3 text-right">PAYE</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No POSTED runs to export yet.</td></tr>
              )}
              {runs.map(r => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{MONTHS[r.month - 1]} {r.year}</td>
                  <td className="p-3 text-right font-mono">{Number(r.totalGross).toLocaleString()}</td>
                  <td className="p-3 text-right">
                    <a href={`/api/payroll/statutory/ssnit/${r.year}/${r.month}`} target="_blank" rel="noopener">
                      <Button size="sm" variant="outline"><FileDown className="h-3.5 w-3.5 mr-1" /> SSNIT CSV</Button>
                    </a>
                  </td>
                  <td className="p-3 text-right">
                    <a href={`/api/payroll/statutory/paye/${r.year}/${r.month}`} target="_blank" rel="noopener">
                      <Button size="sm" variant="outline"><FileDown className="h-3.5 w-3.5 mr-1" /> PAYE CSV</Button>
                    </a>
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
