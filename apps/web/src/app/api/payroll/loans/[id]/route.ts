import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const patchSchema = z.object({
  status: z.enum(["CANCELLED"]).optional(),
})

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  const existing = await prisma.payrollLoan.findFirst({ where: { id: ctx.params.id, workspaceId } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

  const loan = await prisma.payrollLoan.update({ where: { id: ctx.params.id }, data: parsed.data })
  await prisma.auditLog.create({
    data: { workspaceId, userId, entityType: "payroll_loan", entityId: loan.id, action: "UPDATE", afterState: parsed.data },
  })
  return NextResponse.json({ loan })
}
