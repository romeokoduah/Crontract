import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

export async function GET(_: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!

  const run = await prisma.payrollRun.findFirst({
    where: { id: ctx.params.id, workspaceId },
    include: {
      payslips: {
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true, jobTitle: true },
          },
        },
        orderBy: { employeeId: "asc" },
      },
    },
  })
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ run })
}

export async function DELETE(_: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  const run = await prisma.payrollRun.findFirst({ where: { id: ctx.params.id, workspaceId } })
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (run.status !== "DRAFT") {
    return NextResponse.json({ error: `Cannot delete run in status ${run.status}` }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.payslip.deleteMany({ where: { payrollRunId: ctx.params.id } }),
    prisma.payrollRun.delete({ where: { id: ctx.params.id } }),
    prisma.auditLog.create({
      data: { workspaceId, userId, entityType: "payroll_run", entityId: ctx.params.id, action: "DELETE" },
    }),
  ])
  return NextResponse.json({ ok: true })
}
