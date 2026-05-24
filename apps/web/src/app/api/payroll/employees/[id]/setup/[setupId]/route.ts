import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const updateSchema = z.object({
  amount: z.number().nonnegative().optional(),
  endDate: z.string().nullable().optional(),
})

async function verifyOwnership(employeeId: string, setupId: string, workspaceId: string) {
  const setup = await prisma.employeePaySetup.findFirst({
    where: { id: setupId, employeeId, employee: { workspaceId } },
  })
  return setup
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string; setupId: string } }) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  const existing = await verifyOwnership(ctx.params.id, ctx.params.setupId, workspaceId)
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

  const setup = await prisma.employeePaySetup.update({
    where: { id: ctx.params.setupId },
    data: {
      amount: parsed.data.amount,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : (parsed.data.endDate === null ? null : undefined),
    },
  })
  await prisma.auditLog.create({
    data: { workspaceId, userId, entityType: "employee_pay_setup", entityId: setup.id, action: "UPDATE", afterState: parsed.data },
  })
  return NextResponse.json({ setup })
}

export async function DELETE(_: NextRequest, ctx: { params: { id: string; setupId: string } }) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  const existing = await verifyOwnership(ctx.params.id, ctx.params.setupId, workspaceId)
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.employeePaySetup.delete({ where: { id: ctx.params.setupId } })
  await prisma.auditLog.create({
    data: { workspaceId, userId, entityType: "employee_pay_setup", entityId: ctx.params.setupId, action: "DELETE" },
  })
  return NextResponse.json({ ok: true })
}
