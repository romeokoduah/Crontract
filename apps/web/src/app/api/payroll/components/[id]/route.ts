import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["EARNING", "DEDUCTION", "STATUTORY", "LOAN"]).optional(),
  taxable: z.boolean().optional(),
  pensionable: z.boolean().optional(),
  defaultAmount: z.number().nonnegative().nullable().optional(),
  sequence: z.number().int().optional(),
})

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  const existing = await prisma.payComponent.findFirst({ where: { id: ctx.params.id, workspaceId } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

  const component = await prisma.payComponent.update({
    where: { id: ctx.params.id },
    data: parsed.data,
  })
  await prisma.auditLog.create({
    data: {
      workspaceId, userId,
      entityType: "pay_component", entityId: component.id,
      action: "UPDATE", afterState: parsed.data,
    },
  })
  return NextResponse.json({ component })
}

export async function DELETE(_: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  const existing = await prisma.payComponent.findFirst({ where: { id: ctx.params.id, workspaceId } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.payComponent.update({ where: { id: ctx.params.id }, data: { deletedAt: new Date() } })
  await prisma.auditLog.create({
    data: {
      workspaceId, userId,
      entityType: "pay_component", entityId: ctx.params.id,
      action: "DELETE",
    },
  })
  return NextResponse.json({ ok: true })
}
