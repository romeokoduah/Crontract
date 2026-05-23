import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"
import { applyLoanRepayments, buildPayrollJournalLines } from "@/lib/payroll/journal-poster"

export async function POST(_: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  const run = await prisma.payrollRun.findFirst({ where: { id: ctx.params.id, workspaceId } })
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (run.status !== "APPROVED") return NextResponse.json({ error: `Run is ${run.status}, not APPROVED` }, { status: 400 })

  try {
    const result = await prisma.$transaction(async (tx) => {
      const { lines } = await buildPayrollJournalLines(tx, workspaceId, run.id)

      const journalNumber = `PAYROLL-${run.year}-${String(run.month).padStart(2, "0")}`
      const journal = await tx.journal.create({
        data: {
          workspaceId,
          number: journalNumber,
          date: new Date(run.year, run.month, 0),   // last day of month
          description: `Payroll posting for ${run.year}-${String(run.month).padStart(2, "0")}`,
          status: "POSTED",
          createdBy: userId,
          lines: { create: lines },
        },
      })

      await applyLoanRepayments(tx, run.id, 1)

      await tx.payslip.updateMany({ where: { payrollRunId: run.id }, data: { status: "POSTED" } })
      const r = await tx.payrollRun.update({
        where: { id: run.id },
        data: { status: "POSTED", postedBy: userId, postedAt: new Date(), postedJournalId: journal.id },
      })
      await tx.auditLog.create({
        data: {
          workspaceId, userId,
          entityType: "payroll_run", entityId: run.id,
          action: "UPDATE",
          afterState: { status: "POSTED", journalId: journal.id, journalNumber },
        },
      })
      return r
    }, { timeout: 30_000 })

    return NextResponse.json({ run: result })
  } catch (err) {
    console.error("[POST /api/payroll/runs/[id]/post]", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
