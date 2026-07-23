import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { isAdmin, requireAuth } from "@/lib/authorization"
import { requirePermission } from "@/lib/authz/guard"

export async function POST(_: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const authDenied = requireAuth(session)
  if (authDenied) return authDenied

  const denied = await requirePermission(
    { id: session!.user.id, roleId: session!.user.roleId! },
    "payroll:run:approve",
    undefined,
    () => isAdmin(session),
  )
  if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  const run = await prisma.payrollRun.findFirst({ where: { id: ctx.params.id, workspaceId } })
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (run.status !== "DRAFT") return NextResponse.json({ error: `Run is ${run.status}, not DRAFT` }, { status: 400 })

  const updated = await prisma.$transaction(async (tx) => {
    await tx.payslip.updateMany({ where: { payrollRunId: run.id }, data: { status: "APPROVED" } })
    const r = await tx.payrollRun.update({
      where: { id: run.id },
      data: { status: "APPROVED", approvedBy: userId, approvedAt: new Date() },
    })
    await tx.auditLog.create({
      data: { workspaceId, userId, entityType: "payroll_run", entityId: run.id, action: "UPDATE", afterState: { status: "APPROVED" } },
    })
    return r
  })
  return NextResponse.json({ run: updated })
}
