import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { RunDetailClient } from "./run-detail-client"

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

export default async function RunDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) redirect("/login")

  const run = await prisma.payrollRun.findFirst({
    where: { id: params.id, workspaceId: session.user.workspaceId },
    include: {
      payslips: {
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, jobTitle: true } },
        },
        orderBy: [{ employee: { lastName: "asc" } }],
      },
      journal: { select: { number: true } },
    },
  })
  if (!run) notFound()

  const plain = {
    id: run.id,
    year: run.year,
    month: run.month,
    status: run.status,
    totals: {
      gross: Number(run.totalGross),
      deductions: Number(run.totalDeductions),
      net: Number(run.totalNet),
      employerCost: Number(run.totalEmployerCost),
    },
    journalNumber: run.journal?.number ?? null,
    approvedAt: run.approvedAt?.toISOString() ?? null,
    postedAt: run.postedAt?.toISOString() ?? null,
    reversedAt: run.reversedAt?.toISOString() ?? null,
    payslips: run.payslips.map(p => ({
      id: p.id,
      employee: p.employee,
      basicSalary: Number(p.basicSalary),
      totalEarnings: Number(p.totalEarnings),
      gross: Number(p.gross),
      paye: Number(p.paye),
      ssnitEmployee: Number(p.ssnitEmployee),
      tier2: Number(p.tier2),
      loanDeductions: Number(p.loanDeductions),
      otherDeductions: Number(p.otherDeductions),
      totalDeductions: Number(p.totalDeductions),
      netPay: Number(p.netPay),
      currency: p.currency,
    })),
  }

  return (
    <div className="p-6 space-y-6">
      <Link href="/payroll" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to runs
      </Link>
      <h1 className="text-2xl font-semibold">Payroll — {MONTHS[run.month - 1]} {run.year}</h1>
      <RunDetailClient run={plain} />
    </div>
  )
}
