import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

export async function DELETE(_: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  const row = await prisma.taxRateTable.findFirst({ where: { id: ctx.params.id, workspaceId } })
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Block delete if a POSTED run exists for this year — would invalidate snapshots
  const posted = await prisma.payrollRun.count({
    where: { workspaceId, year: row.taxYear, status: "POSTED" },
  })
  if (posted > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${posted} POSTED run(s) exist for ${row.taxYear}. Reverse them first.` },
      { status: 400 }
    )
  }

  await prisma.taxRateTable.delete({ where: { id: ctx.params.id } })
  await prisma.auditLog.create({
    data: { workspaceId, userId, entityType: "tax_rate", entityId: ctx.params.id, action: "DELETE" },
  })
  return NextResponse.json({ ok: true })
}
