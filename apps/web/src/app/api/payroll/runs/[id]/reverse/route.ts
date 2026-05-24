import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"
import { applyLoanRepayments } from "@/lib/payroll/journal-poster"

export async function POST(_: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  const run = await prisma.payrollRun.findFirst({
    where: { id: ctx.params.id, workspaceId },
    include: { journal: { include: { lines: true } } },
  })
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (run.status !== "POSTED") return NextResponse.json({ error: `Run is ${run.status}, not POSTED` }, { status: 400 })
  if (!run.journal) return NextResponse.json({ error: "No journal attached to this run" }, { status: 400 })

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create reversing journal — swap debit <-> credit on each line
      const revLines = run.journal!.lines.map(l => ({
        accountId: l.accountId,
        debit: Number(l.credit),
        credit: Number(l.debit),
        memo: `Reversal: ${l.memo ?? ""}`,
      }))
      await tx.journal.create({
        data: {
          workspaceId,
          number: `${run.journal!.number}-REV`,
          date: new Date(),
          description: `Reversal of ${run.journal!.number}`,
          status: "POSTED",
          createdBy: userId,
          lines: { create: revLines },
        },
      })

      // Mark original journal as reversed
      await tx.journal.update({ where: { id: run.journal!.id }, data: { status: "REVERSED" } })

      // Roll back loan balances
      await applyLoanRepayments(tx, run.id, -1)

      await tx.payslip.updateMany({ where: { payrollRunId: run.id }, data: { status: "REVERSED" } })
      const r = await tx.payrollRun.update({
        where: { id: run.id },
        data: { status: "REVERSED", reversedAt: new Date() },
      })
      await tx.auditLog.create({
        data: { workspaceId, userId, entityType: "payroll_run", entityId: run.id, action: "UPDATE", afterState: { status: "REVERSED" } },
      })
      return r
    }, { timeout: 30_000 })

    return NextResponse.json({ run: result })
  } catch (err) {
    console.error("[POST /api/payroll/runs/[id]/reverse]", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
