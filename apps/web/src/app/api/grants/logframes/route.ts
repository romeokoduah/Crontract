import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const createLogframeSchema = z.object({
  grantId: z.string().uuid(),
  goal: z.string().min(1),
  purpose: z.string().min(1),
  outputs: z.any(),
  assumptions: z.any().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const logframes = await prisma.logframe.findMany({
      where: {
        workspaceId: session!.user.workspaceId!,
      },
      include: {
        grant: { select: { title: true, grantNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ logframes })
  } catch (err) {
    console.error("[GET /api/grants/logframes]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireAdminRole(session)
    if (denied) return denied

    const body = await req.json()
    const parsed = createLogframeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", detail: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }

    const data = parsed.data
    const workspaceId = session!.user.workspaceId!
    const userId = session!.user.id

    const logframe = await prisma.logframe.create({
      data: {
        workspaceId,
        grantId: data.grantId,
        goal: data.goal,
        purpose: data.purpose,
        outputs: data.outputs,
        assumptions: data.assumptions,
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType: "logframe",
        entityId: logframe.id,
        action: "CREATE",
        afterState: { grantId: logframe.grantId, goal: logframe.goal.substring(0, 100) },
      },
    })

    return NextResponse.json({ logframe }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/grants/logframes]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
