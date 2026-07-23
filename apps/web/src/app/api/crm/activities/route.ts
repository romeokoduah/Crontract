import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { isAdmin, requireAuth } from "@/lib/authorization"
import { requirePermission, scopeWhere } from "@/lib/authz/guard"
import { loadRoleGrants } from "@/lib/authz/grants"
import { AUTHZ_ENFORCED } from "@/lib/env"

const createActivitySchema = z.object({
  type: z.enum(["CALL", "EMAIL", "MEETING", "NOTE", "TASK"]),
  subject: z.string().min(1, "Subject is required"),
  description: z.string().optional(),
  contactId: z.string().uuid().optional().or(z.literal("")),
  dealId: z.string().uuid().optional().or(z.literal("")),
  dueDate: z.string().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const authDenied = requireAuth(session)
    if (authDenied) return authDenied

    const denied = await requirePermission(
      { id: session!.user.id, roleId: session!.user.roleId! },
      "crm:activity:manage",
      undefined,
      () => isAdmin(session),
    )
    if (denied) return denied

    const scoped = AUTHZ_ENFORCED
      ? scopeWhere(
          { id: session!.user.id },
          (await loadRoleGrants(session!.user.roleId!)).get("crm:activity:manage") ?? "OWN",
          { ownerFields: ["createdBy"] },
        )
      : {}

    const activities = await prisma.crmActivity.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
        ...scoped,
      },
      include: {
        contact: { select: { firstName: true, lastName: true } },
        deal: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ activities })
  } catch (err) {
    console.error("[GET /api/crm/activities]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const authDenied = requireAuth(session)
    if (authDenied) return authDenied

    const denied = await requirePermission(
      { id: session!.user.id, roleId: session!.user.roleId! },
      "crm:activity:manage",
      undefined,
      () => isAdmin(session),
    )
    if (denied) return denied

    const body = await req.json()
    const parsed = createActivitySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    // Verify any referenced records belong to this workspace (no cross-tenant FK association).
    if (data.contactId) {
      const contact = await prisma.crmContact.findFirst({ where: { id: data.contactId, workspaceId }, select: { id: true } })
      if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 400 })
    }
    if (data.dealId) {
      const deal = await prisma.crmDeal.findFirst({ where: { id: data.dealId, workspaceId }, select: { id: true } })
      if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 400 })
    }

    const activity = await prisma.crmActivity.create({
      data: {
        workspaceId,
        type: data.type,
        subject: data.subject,
        description: data.description,
        contactId: data.contactId || null,
        dealId: data.dealId || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        createdBy: userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "crm_activity",
        entityId: activity.id,
        action: "CREATE",
        afterState: { type: activity.type, subject: activity.subject },
      },
    })

    return NextResponse.json({ activity }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/crm/activities]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
