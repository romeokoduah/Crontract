import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

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
    const denied = requireAdminRole(session)
    if (denied) return denied

    const activities = await prisma.crmActivity.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
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
    const denied = requireAdminRole(session)
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
