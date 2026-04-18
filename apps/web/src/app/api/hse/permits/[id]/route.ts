import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const patchSchema = z.object({
  status: z.enum(["DRAFT", "REQUESTED", "APPROVED", "ACTIVE", "SUSPENDED", "CLOSED", "EXPIRED"]).optional(),
  issuedBy: z.string().uuid().optional().nullable(),
  issuedDate: z.string().optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const existing = await prisma.permit.findFirst({
      where: { id: params.id, workspaceId: session!.user.workspaceId! },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const permit = await prisma.permit.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.issuedBy !== undefined ? { issuedBy: parsed.data.issuedBy } : {}),
        ...(parsed.data.issuedDate !== undefined ? { issuedDate: parsed.data.issuedDate ? new Date(parsed.data.issuedDate) : null } : {}),
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "permit",
        entityId: permit.id,
        action: "UPDATE",
        beforeState: { status: existing.status },
        afterState: { status: permit.status },
      },
    })

    return NextResponse.json({ permit })
  } catch (err) {
    console.error("[PATCH /api/hse/permits/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
